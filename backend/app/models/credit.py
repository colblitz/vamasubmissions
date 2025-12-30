"""Credit transaction model."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.core.database import Base


class CreditTransaction(Base):
    """Credit transaction model for audit trail."""
    
    __tablename__ = "credit_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # positive for additions, negative for spending
    transaction_type = Column(String(50), nullable=False)  # monthly_refresh, submission_cost, refund, adjustment
    description = Column(Text)
    submission_id = Column(Integer, ForeignKey("submissions.id"), index=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="credit_transactions")
    submission = relationship("Submission", back_populates="credit_transaction")
    
    def __repr__(self):
        return f"<CreditTransaction(id={self.id}, user_id={self.user_id}, amount={self.amount}, type={self.transaction_type})>"
