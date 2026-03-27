"""
Payments Router - Stripe Integration
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import os
import stripe

from ..database.connection import get_db
from ..database.models import User
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/api/payments", tags=["Payments"])

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# Price IDs (set in Stripe Dashboard)
PRICE_PRO_MONTHLY = os.getenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly")
PRICE_PRO_YEARLY = os.getenv("STRIPE_PRICE_PRO_YEARLY", "price_pro_yearly")


# ============================================================================
# Schemas
# ============================================================================

class CreateCheckoutRequest(BaseModel):
    plan: str  # 'pro_monthly' or 'pro_yearly'
    success_url: str
    cancel_url: str


class SubscriptionStatus(BaseModel):
    is_pro: bool
    plan: Optional[str]
    expires_at: Optional[datetime]
    stripe_customer_id: Optional[str]
    stripe_subscription_id: Optional[str]


# ============================================================================
# Checkout
# ============================================================================

@router.post("/create-checkout-session")
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session"""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Get or create Stripe customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": current_user.id},
        )
        current_user.stripe_customer_id = customer.id
        db.commit()

    # Determine price ID
    if request.plan == "pro_monthly":
        price_id = PRICE_PRO_MONTHLY
    elif request.plan == "pro_yearly":
        price_id = PRICE_PRO_YEARLY
    else:
        raise HTTPException(status_code=400, detail="Invalid plan")

    try:
        session = stripe.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[
                {
                    "price": price_id,
                    "quantity": 1,
                }
            ],
            mode="subscription",
            success_url=request.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=request.cancel_url,
            metadata={
                "user_id": current_user.id,
                "plan": request.plan,
            },
        )

        return {"checkout_url": session.url, "session_id": session.id}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Subscription Status
# ============================================================================

@router.get("/subscription", response_model=SubscriptionStatus)
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
):
    """Get current subscription status"""
    return SubscriptionStatus(
        is_pro=current_user.is_pro,
        plan=current_user.subscription_plan,
        expires_at=current_user.subscription_expires_at,
        stripe_customer_id=current_user.stripe_customer_id,
        stripe_subscription_id=current_user.stripe_subscription_id,
    )


@router.post("/cancel-subscription")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel the current subscription"""
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    try:
        # Cancel at period end
        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            cancel_at_period_end=True,
        )

        return {"success": True, "message": "Subscription will be canceled at the end of the billing period"}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Customer Portal
# ============================================================================

@router.post("/create-portal-session")
async def create_portal_session(
    return_url: str,
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session for managing subscription"""
    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer found")

    try:
        session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=return_url,
        )
        return {"portal_url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Webhook
# ============================================================================

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan = session.get("metadata", {}).get("plan")

        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.stripe_subscription_id = session.get("subscription")
                user.subscription_plan = plan
                user.is_pro = True
                user.subscription_expires_at = datetime.utcnow() + timedelta(days=30 if "monthly" in plan else 365)
                db.commit()

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            if subscription.get("status") == "active":
                user.is_pro = True
                # Update expiration based on current period end
                period_end = subscription.get("current_period_end")
                if period_end:
                    user.subscription_expires_at = datetime.fromtimestamp(period_end)
            else:
                user.is_pro = False
            db.commit()

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            user.is_pro = False
            user.stripe_subscription_id = None
            user.subscription_plan = None
            user.subscription_expires_at = None
            db.commit()

    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")

        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
        if user:
            # Mark subscription as failed but don't immediately revoke access
            # Give them a grace period
            pass

    return {"received": True}
