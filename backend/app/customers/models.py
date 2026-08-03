import uuid
from datetime import datetime
from sqlalchemy import Column, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    phone = Column(String(20), unique=True, index=True, nullable=False) # E.164 format e.g. +212600000000
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    addresses = relationship("Address", back_populates="customer", cascade="all, delete-orphan")

class Address(Base):
    __tablename__ = "addresses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    city = Column(String, nullable=False)
    address_line = Column(String, nullable=False)
    zone = Column(String, nullable=True) # e.g. 'Zone 1', 'Zone 2'

    customer = relationship("Customer", back_populates="addresses")
