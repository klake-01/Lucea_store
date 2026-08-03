from typing import Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.commerce.models import ShippingZone

async def calculate_shipping_charge(db: AsyncSession, city: str, subtotal_cents: int) -> Tuple[int, str]:
    """Calculates delivery charge in cents based on city and subtotal threshold (P-D5)"""
    clean_city = city.strip().lower()

    res = await db.execute(select(ShippingZone))
    zones = res.scalars().all()

    zone_name = "Zone 3"
    cost = 4500
    free_threshold = 45000

    for z in zones:
        covered = [c.lower() for c in z.cities_covered]
        if clean_city in covered:
            zone_name = z.zone_name
            cost = z.shipping_cost_cents
            free_threshold = z.free_threshold_cents
            break

    # Subtotal calculated pre-tax and post-discount (BR-2)
    if subtotal_cents >= free_threshold:
        return 0, zone_name
    return cost, zone_name
