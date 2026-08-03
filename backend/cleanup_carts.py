import asyncio
from datetime import datetime, timedelta
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.orders.models import Cart

async def cleanup_abandoned_carts():
    threshold = datetime.utcnow() - timedelta(days=30)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Cart).where(Cart.customer_id.is_(None), Cart.updated_at < threshold)
        )
        carts = result.scalars().all()
        count = len(carts)
        for cart in carts:
            await db.delete(cart)
        
        await db.commit()
        print(f"Deleted {count} abandoned guest carts.")

if __name__ == "__main__":
    asyncio.run(cleanup_abandoned_carts())
