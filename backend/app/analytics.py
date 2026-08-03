"""Dashboard analytics.

Every number here is computed from the same tables the rest of the admin reads,
so a figure on the dashboard and the list it summarises can never disagree.

Revenue counts **delivered orders only**. A pending cash on delivery order is
not money: under COD a meaningful share of parcels are refused at the door, and
counting them as revenue would make the dashboard flatter itself.
"""

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.catalog.models import Product, Variant
from app.orders.models import Order, OrderItem
from app.reviews.models import NewsletterSubscriber, Review

# Only these count as money in the till
REVENUE_STATUSES = ("delivered",)
OPEN_STATUSES = ("pending", "confirmed", "dispatched")


async def _scalar(db: AsyncSession, stmt) -> int:
    return (await db.execute(stmt)).scalar() or 0


async def build_dashboard(db: AsyncSession, days: int = 30) -> dict:
    now = datetime.utcnow()
    since = now - timedelta(days=days)
    previous_since = since - timedelta(days=days)

    # ---------------- headline counters ----------------
    total_orders = await _scalar(db, select(func.count(Order.id)))
    open_orders = await _scalar(
        db, select(func.count(Order.id)).where(Order.status.in_(OPEN_STATUSES))
    )
    pending_orders = await _scalar(
        db, select(func.count(Order.id)).where(Order.status == "pending")
    )
    delivered_orders = await _scalar(
        db, select(func.count(Order.id)).where(Order.status == "delivered")
    )
    cancelled_orders = await _scalar(
        db, select(func.count(Order.id)).where(Order.status.in_(("cancelled", "returned")))
    )

    revenue_cents = await _scalar(
        db, select(func.sum(Order.total_cents)).where(Order.status.in_(REVENUE_STATUSES))
    )
    # Value sitting in orders that have not settled either way
    pipeline_cents = await _scalar(
        db, select(func.sum(Order.total_cents)).where(Order.status.in_(OPEN_STATUSES))
    )

    period_revenue = await _scalar(
        db, select(func.sum(Order.total_cents)).where(
            Order.status.in_(REVENUE_STATUSES), Order.created_at >= since
        )
    )
    previous_revenue = await _scalar(
        db, select(func.sum(Order.total_cents)).where(
            Order.status.in_(REVENUE_STATUSES),
            Order.created_at >= previous_since, Order.created_at < since,
        )
    )
    period_orders = await _scalar(
        db, select(func.count(Order.id)).where(Order.created_at >= since)
    )
    previous_orders = await _scalar(
        db, select(func.count(Order.id)).where(
            Order.created_at >= previous_since, Order.created_at < since
        )
    )

    def delta(current: int, previous: int) -> Optional[float]:
        """None rather than 0 when there is no base to compare against, so the
        UI can say 'no comparison' instead of a misleading 0 percent."""
        if not previous:
            return None
        return round(((current - previous) / previous) * 100, 1)

    settled = delivered_orders + cancelled_orders

    # ---------------- daily series ----------------
    # Grouped in Python rather than SQL so the same code works on PostgreSQL and
    # on the SQLite used by the tests.
    rows = (await db.execute(
        select(Order.created_at, Order.total_cents, Order.status)
        .where(Order.created_at >= since)
    )).all()

    buckets: dict[str, dict] = {}
    for i in range(days):
        day = (since + timedelta(days=i + 1)).date().isoformat()
        buckets[day] = {"date": day, "orders": 0, "revenue_cents": 0, "delivered": 0}

    for created_at, total, status_value in rows:
        key = created_at.date().isoformat()
        bucket = buckets.get(key)
        if bucket is None:
            continue
        bucket["orders"] += 1
        if status_value in REVENUE_STATUSES:
            bucket["revenue_cents"] += total or 0
            bucket["delivered"] += 1

    series = list(buckets.values())

    # ---------------- breakdowns ----------------
    status_rows = (await db.execute(
        select(Order.status, func.count(Order.id)).group_by(Order.status)
    )).all()
    status_breakdown = [{"status": s, "count": c} for s, c in status_rows]

    city_rows = (await db.execute(
        select(Order.city, func.count(Order.id), func.sum(Order.total_cents))
        .group_by(Order.city)
        .order_by(func.count(Order.id).desc())
        .limit(6)
    )).all()
    top_cities = [
        {"city": c or "Inconnue", "orders": n, "revenue_cents": int(v or 0)}
        for c, n, v in city_rows
    ]

    product_rows = (await db.execute(
        select(
            OrderItem.snapshotted_product_name,
            func.sum(OrderItem.quantity),
            func.sum(OrderItem.snapshotted_price_cents * OrderItem.quantity),
        )
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.status.in_(REVENUE_STATUSES + OPEN_STATUSES))
        .group_by(OrderItem.snapshotted_product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(6)
    )).all()
    top_products = [
        {"name": n or "Inconnu", "units": int(q or 0), "revenue_cents": int(v or 0)}
        for n, q, v in product_rows
    ]

    # ---------------- inventory ----------------
    low_stock_rows = (await db.execute(
        select(Variant, Product.name)
        .join(Product, Product.id == Variant.product_id)
        .order_by((Variant.stock - Variant.reserved).asc())
        .limit(8)
    )).all()
    low_stock = [
        {
            "sku": v.sku,
            "product": name,
            "stock": v.stock,
            "reserved": v.reserved or 0,
            "available": max(0, (v.stock or 0) - (v.reserved or 0)),
        }
        for v, name in low_stock_rows
    ]
    units_reserved = await _scalar(db, select(func.sum(Variant.reserved)))

    # ---------------- reviews and audience ----------------
    review_rows = (await db.execute(
        select(Review.status, func.count(Review.id)).group_by(Review.status)
    )).all()
    reviews_by_status = {s: c for s, c in review_rows}

    rating_rows = (await db.execute(
        select(Review.rating, func.count(Review.id))
        .where(Review.status == "published")
        .group_by(Review.rating)
    )).all()
    rating_distribution = {str(i): 0 for i in range(1, 6)}
    weighted = published_count = 0
    for rating, count in rating_rows:
        rating_distribution[str(rating)] = count
        weighted += rating * count
        published_count += count

    subscribers = await _scalar(db, select(func.count(NewsletterSubscriber.id)))
    subscribers_new = await _scalar(
        db, select(func.count(NewsletterSubscriber.id))
        .where(NewsletterSubscriber.created_at >= since)
    )

    average_order_cents = int(revenue_cents / delivered_orders) if delivered_orders else 0

    return {
        "period_days": days,
        "generated_at": now.isoformat(),
        "totals": {
            "orders": total_orders,
            "open_orders": open_orders,
            "pending_orders": pending_orders,
            "delivered_orders": delivered_orders,
            "cancelled_orders": cancelled_orders,
            # Revenue is delivered only, see the module docstring
            "revenue_cents": int(revenue_cents),
            "pipeline_cents": int(pipeline_cents),
            "average_order_cents": average_order_cents,
            "units_reserved": int(units_reserved),
            "subscribers": subscribers,
        },
        "period": {
            "revenue_cents": int(period_revenue),
            "orders": period_orders,
            "revenue_change_percent": delta(period_revenue, previous_revenue),
            "orders_change_percent": delta(period_orders, previous_orders),
            "new_subscribers": subscribers_new,
        },
        "rates": {
            # Of the orders that reached an outcome, how many were delivered
            "delivery_rate": round(delivered_orders / settled * 100, 1) if settled else None,
            "refusal_rate": round(cancelled_orders / settled * 100, 1) if settled else None,
            "settled_orders": settled,
        },
        "series": series,
        "status_breakdown": status_breakdown,
        "top_cities": top_cities,
        "top_products": top_products,
        "low_stock": low_stock,
        "reviews": {
            "pending": reviews_by_status.get("pending", 0),
            "published": reviews_by_status.get("published", 0),
            "rejected": reviews_by_status.get("rejected", 0),
            "average_rating": round(weighted / published_count, 2) if published_count else 0,
            "distribution": rating_distribution,
        },
    }
