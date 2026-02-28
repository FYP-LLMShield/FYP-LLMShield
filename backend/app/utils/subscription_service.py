from datetime import datetime, timedelta
from typing import Optional, Dict, List
from fastapi import HTTPException, status
from bson import ObjectId
from app.core.database import get_database
from app.models.subscription import (
    SubscriptionInDB, UsageInDB, SubscriptionTier, ScanType,
    SUBSCRIPTION_FEATURES, get_current_month_year, 
    calculate_trial_end, get_next_billing_date,
    SubscriptionResponse, UsageResponse
)

class SubscriptionService:
    def __init__(self):
        self.db = None
    
    async def get_db(self):
        if not self.db:
            self.db = await get_database()
        return self.db
    
    async def create_subscription(
        self, 
        user_id: str, 
        tier: SubscriptionTier = SubscriptionTier.PREMIUM,  # For now, everyone gets premium
        is_trial: bool = False,
        trial_days: int = 7
    ) -> SubscriptionInDB:
        """Create new subscription for user"""
        db = await self.get_db()
        
        # Check if user already has subscription
        existing = await db.subscriptions.find_one({"user_id": ObjectId(user_id)})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already has a subscription"
            )
        
        subscription_data = {
            "user_id": ObjectId(user_id),
            "tier": tier,
            "status": "active",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_trial": is_trial
        }
        
        if is_trial:
            subscription_data.update({
                "trial_start": datetime.utcnow(),
                "trial_end": calculate_trial_end(trial_days)
            })
        else:
            subscription_data.update({
                "billing_cycle_start": datetime.utcnow(),
                "billing_cycle_end": get_next_billing_date(tier),
                "next_billing_date": get_next_billing_date(tier)
            })
        
        result = await db.subscriptions.insert_one(subscription_data)
        subscription_data["_id"] = result.inserted_id
        
        # Create initial usage record
        await self.create_usage_record(str(result.inserted_id), user_id)
        
        return SubscriptionInDB(**subscription_data)
    
    async def get_user_subscription(self, user_id: str) -> Optional[SubscriptionInDB]:
        """Get user's current subscription"""
        db = await self.get_db()
        
        subscription = await db.subscriptions.find_one({"user_id": ObjectId(user_id)})
        if subscription:
            return SubscriptionInDB(**subscription)
        return None
    
    async def update_subscription_tier(self, user_id: str, new_tier: SubscriptionTier) -> SubscriptionInDB:
        """Update user's subscription tier"""
        db = await self.get_db()
        
        update_data = {
            "tier": new_tier,
            "updated_at": datetime.utcnow()
        }
        
        # Update billing cycle for paid tiers
        if new_tier != SubscriptionTier.FREE:
            update_data.update({
                "billing_cycle_start": datetime.utcnow(),
                "billing_cycle_end": get_next_billing_date(new_tier),
                "next_billing_date": get_next_billing_date(new_tier)
            })
        
        result = await db.subscriptions.find_one_and_update(
            {"user_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True
        )
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )
        
        # Update user's denormalized fields
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "current_subscription_tier": new_tier,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return SubscriptionInDB(**result)
    
    async def create_usage_record(self, subscription_id: str, user_id: str) -> UsageInDB:
        """Create or get current month's usage record"""
        db = await self.get_db()
        current_month = get_current_month_year()
        
        # Check if record already exists
        existing = await db.usage.find_one({
            "user_id": ObjectId(user_id),
            "month_year": current_month
        })
        
        if existing:
            return UsageInDB(**existing)
        
        usage_data = {
            "user_id": ObjectId(user_id),
            "subscription_id": ObjectId(subscription_id),
            "month_year": current_month,
            "scan_counts": {},
            "total_scans": 0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_reset": datetime.utcnow()
        }
        
        result = await db.usage.insert_one(usage_data)
        usage_data["_id"] = result.inserted_id
        
        return UsageInDB(**usage_data)
    
    async def get_current_usage(self, user_id: str) -> Optional[UsageInDB]:
        """Get current month's usage for user"""
        db = await self.get_db()
        current_month = get_current_month_year()
        
        usage = await db.usage.find_one({
            "user_id": ObjectId(user_id),
            "month_year": current_month
        })
        
        if usage:
            return UsageInDB(**usage)
        return None
    
    async def record_scan_usage(self, user_id: str, scan_type: ScanType) -> bool:
        """Record a scan usage - returns True if allowed, False if limit exceeded"""
        # FOR NOW: Always return True (unlimited for everyone)
        # This will be activated when you want to enforce limits
        return True
        
        # Future implementation when limits are enforced:
        """
        db = await self.get_db()
        current_month = get_current_month_year()
        
        # Get subscription and usage
        subscription = await self.get_user_subscription(user_id)
        if not subscription:
            return False
        
        # Check if scan type is allowed
        if not can_access_scan_type(subscription.tier, scan_type):
            return False
        
        # Check if unlimited
        if is_unlimited(subscription.tier):
            # Record usage but don't enforce limits
            await db.usage.update_one(
                {"user_id": ObjectId(user_id), "month_year": current_month},
                {
                    "$inc": {
                        f"scan_counts.{scan_type}": 1,
                        "total_scans": 1
                    },
                    "$set": {"updated_at": datetime.utcnow()}
                },
                upsert=True
            )
            return True
        
        # Check limits for limited tiers
        usage = await self.get_current_usage(user_id)
        if not usage:
            # Create usage record
            usage = await self.create_usage_record(str(subscription.id), user_id)
        
        monthly_limit = get_monthly_limit(subscription.tier)
        if monthly_limit and usage.total_scans >= monthly_limit:
            return False  # Limit exceeded
        
        # Record the usage
        await db.usage.update_one(
            {"user_id": ObjectId(user_id), "month_year": current_month},
            {
                "$inc": {
                    f"scan_counts.{scan_type}": 1,
                    "total_scans": 1
                },
                "$set": {"updated_at": datetime.utcnow()}
            }
        )
        
        return True
        """
    
    async def can_access_feature(self, user_id: str, feature: str) -> bool:
        """Check if user can access a specific feature - FOR NOW returns True for all"""
        return True
        
        # Future implementation:
        """
        subscription = await self.get_user_subscription(user_id)
        if not subscription:
            return False
        
        allowed_features = SUBSCRIPTION_FEATURES[subscription.tier]["features"]
        return feature in allowed_features
        """
    
    async def can_perform_scan(self, user_id: str, scan_type: ScanType) -> tuple[bool, str]:
        """Check if user can perform scan type - returns (can_scan, reason)"""
        # FOR NOW: Always allow all scan types
        return True, "Access granted"
        
        # Future implementation:
        """
        subscription = await self.get_user_subscription(user_id)
        if not subscription:
            return False, "No subscription found"
        
        # Check if scan type is allowed for tier
        if not can_access_scan_type(subscription.tier, scan_type):
            return False, f"Scan type not available in {subscription.tier} tier"
        
        # Check usage limits (unless unlimited)
        if not is_unlimited(subscription.tier):
            usage = await self.get_current_usage(user_id)
            monthly_limit = get_monthly_limit(subscription.tier)
            
            if usage and monthly_limit and usage.total_scans >= monthly_limit:
                return False, f"Monthly limit of {monthly_limit} scans exceeded"
        
        return True, "Access granted"
        """
    
    async def get_subscription_summary(self, user_id: str) -> SubscriptionResponse:
        """Get complete subscription summary for user"""
        subscription = await self.get_user_subscription(user_id)
        usage = await self.get_current_usage(user_id)
        
        if not subscription:
            # Create default premium subscription for now
            subscription = await self.create_subscription(user_id, SubscriptionTier.PREMIUM)
            usage = await self.create_usage_record(str(subscription.id), user_id)
        
        features = SUBSCRIPTION_FEATURES[subscription.tier]["features"]
        scan_types = [scan.value for scan in SUBSCRIPTION_FEATURES[subscription.tier]["scan_types"]]
        monthly_limit = SUBSCRIPTION_FEATURES[subscription.tier]["monthly_limit"]
        unlimited = SUBSCRIPTION_FEATURES[subscription.tier]["unlimited"]
        
        current_usage = usage.scan_counts if usage else {}
        total_used = usage.total_scans if usage else 0
        remaining = monthly_limit - total_used if monthly_limit else None
        
        return SubscriptionResponse(
            id=str(subscription.id),
            user_id=user_id,
            tier=subscription.tier,
            status=subscription.status,
            features=features,
            scan_types_allowed=scan_types,
            monthly_limit=monthly_limit,
            unlimited=unlimited,
            current_usage=current_usage,
            remaining_scans=remaining,
            billing_cycle_end=subscription.billing_cycle_end,
            is_trial=subscription.is_trial,
            trial_end=subscription.trial_end
        )
    
    async def get_usage_summary(self, user_id: str) -> UsageResponse:
        """Get usage summary for current month"""
        usage = await self.get_current_usage(user_id)
        subscription = await self.get_user_subscription(user_id)
        
        if not usage:
            return UsageResponse(
                month_year=get_current_month_year(),
                total_scans=0,
                scan_counts={},
                limit=None,
                remaining=None,
                unlimited=True
            )
        
        monthly_limit = None
        unlimited = True
        remaining = None
        
        if subscription:
            monthly_limit = SUBSCRIPTION_FEATURES[subscription.tier]["monthly_limit"]
            unlimited = SUBSCRIPTION_FEATURES[subscription.tier]["unlimited"]
            remaining = monthly_limit - usage.total_scans if monthly_limit else None
        
        return UsageResponse(
            month_year=usage.month_year,
            total_scans=usage.total_scans,
            scan_counts=usage.scan_counts,
            limit=monthly_limit,
            remaining=remaining,
            unlimited=unlimited
        )
    
    # Admin functions
    async def admin_update_user_subscription(self, user_id: str, tier: SubscriptionTier) -> SubscriptionInDB:
        """Admin function to update any user's subscription"""
        return await self.update_subscription_tier(user_id, tier)
    
    async def admin_reset_user_usage(self, user_id: str) -> bool:
        """Admin function to reset user's current month usage"""
        db = await self.get_db()
        current_month = get_current_month_year()
        
        result = await db.usage.update_one(
            {"user_id": ObjectId(user_id), "month_year": current_month},
            {
                "$set": {
                    "scan_counts": {},
                    "total_scans": 0,
                    "last_reset": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count > 0

# Global instance
subscription_service = SubscriptionService()