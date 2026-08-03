import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean

from app.database import Base


class Review(Base):
    """A customer review.

    Routing rule, from the brief: a rating of 4 or 5 is published immediately,
    anything at 3 or below is held for a human to read first.

    The intent is not to hide criticism. A low rating is usually a service
    problem the workshop can still fix, an undelivered parcel or a wrong
    engraving, and it is worth a phone call before it becomes a public review.
    Staff can publish a held review unchanged, which is why the moderation
    states are explicit and the original text is never edited by the system.
    """

    __tablename__ = "reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    rating = Column(Integer, nullable=False)          # 1 to 5
    title = Column(String, nullable=True)
    body = Column(Text, nullable=False)

    author_name = Column(String, nullable=False)
    author_city = Column(String, nullable=True)
    # Contact details are for the workshop to follow up on a poor experience.
    # They are never exposed on the storefront.
    author_email = Column(String, nullable=True)
    author_phone = Column(String, nullable=True)

    # Optional link to what was bought
    product_id = Column(String, index=True, nullable=True)
    product_name = Column(String, nullable=True)
    order_number = Column(String, index=True, nullable=True)
    # True when the order number matched a real order for that phone
    verified_purchase = Column(Boolean, default=False, nullable=False)

    # pending | published | rejected
    status = Column(String, default="pending", index=True, nullable=False)
    # Why it landed where it did, so the admin list is self explaining
    routing_reason = Column(String, nullable=True)

    moderated_by = Column(String, nullable=True)      # staff user id
    moderated_at = Column(DateTime, nullable=True)
    staff_note = Column(Text, nullable=True)

    submitted_ip = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class NewsletterSubscriber(Base):
    """An address captured by the welcome offer form.

    Kept separate from customers because an interested visitor who never
    ordered is a different thing from a buyer, and mixing them would distort
    every customer metric in the admin.
    """

    __tablename__ = "newsletter_subscribers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, default="home_welcome_offer", nullable=False)
    # Set once the address is seen on an order, so the admin can tell an
    # interested visitor from one who converted.
    converted = Column(Boolean, default=False, nullable=False)
    discount_code = Column(String, nullable=True)
    unsubscribed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
