"""
Scan History Service
Handles saving and retrieving scan history for users
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.scan_history import (
    ScanHistoryCreate, 
    ScanHistoryInDB, 
    ScanHistoryResponse, 
    ScanHistoryDetailResponse
)


class ScanHistoryService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.collection = database.scan_history

    async def create_scan_history(self, user_id: str, scan_data: ScanHistoryCreate) -> ScanHistoryInDB:
        """Create a new scan history entry for a user"""
        scan_history = ScanHistoryInDB(
            user_id=ObjectId(user_id),
            **scan_data.dict()
        )
        
        # Insert into database
        result = await self.collection.insert_one(scan_history.dict(by_alias=True))
        
        # Return the created scan history with the generated ID
        scan_history.id = result.inserted_id
        return scan_history

    async def get_user_scan_history(
        self, 
        user_id: str, 
        limit: int = 50, 
        skip: int = 0,
        scan_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[ScanHistoryResponse]:
        """Get scan history for a specific user with optional filtering"""
        
        # Build query filter
        query = {"user_id": ObjectId(user_id)}
        
        if scan_type:
            query["scan_type"] = scan_type
        
        if status:
            query["status"] = status
        
        # Execute query with sorting (most recent first)
        cursor = self.collection.find(query).sort("timestamp", -1).skip(skip).limit(limit)
        
        scan_histories = []
        async for doc in cursor:
            # Convert ObjectId to string for response
            doc["id"] = str(doc["_id"])
            doc["user_id"] = str(doc["user_id"])
            
            # Create response model (excludes scan_results for list view)
            scan_history = ScanHistoryResponse(**doc)
            scan_histories.append(scan_history)
        
        return scan_histories

    async def get_user_scan_count(
        self, 
        user_id: str, 
        scan_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> int:
        """Get total count of scan history for a specific user with optional filtering"""
        
        # Build query filter
        query = {"user_id": ObjectId(user_id)}
        
        if scan_type:
            query["scan_type"] = scan_type
        
        if status:
            query["status"] = status
        
        # Get count
        count = await self.collection.count_documents(query)
        return count

    async def get_scan_history_detail(self, user_id: str, scan_history_id: str) -> Optional[ScanHistoryDetailResponse]:
        """Get detailed scan history including full scan results"""
        
        query = {
            "_id": ObjectId(scan_history_id),
            "user_id": ObjectId(user_id)
        }
        
        doc = await self.collection.find_one(query)
        
        if not doc:
            return None
        
        # Convert ObjectId to string for response
        doc["id"] = str(doc["_id"])
        doc["user_id"] = str(doc["user_id"])
        
        return ScanHistoryDetailResponse(**doc)

    async def get_user_scan_stats(self, user_id: str) -> Dict[str, Any]:
        """Get scan statistics for a user"""
        
        pipeline = [
            {"$match": {"user_id": ObjectId(user_id)}},
            {
                "$group": {
                    "_id": None,
                    "total_scans": {"$sum": 1},
                    "total_findings": {"$sum": "$total_findings"},
                    "critical_findings": {"$sum": "$critical_findings"},
                    "high_findings": {"$sum": "$high_findings"},
                    "medium_findings": {"$sum": "$medium_findings"},
                    "low_findings": {"$sum": "$low_findings"},
                    "scan_types": {"$addToSet": "$scan_type"},
                    "latest_scan": {"$max": "$timestamp"}
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        
        if not result:
            return {
                "total_scans": 0,
                "total_findings": 0,
                "critical_findings": 0,
                "high_findings": 0,
                "medium_findings": 0,
                "low_findings": 0,
                "scan_types": [],
                "latest_scan": None
            }
        
        stats = result[0]
        stats.pop("_id", None)  # Remove the _id field
        
        return stats

    async def delete_scan_history(self, user_id: str, scan_history_id: str) -> bool:
        """Delete a specific scan history entry"""
        
        query = {
            "_id": ObjectId(scan_history_id),
            "user_id": ObjectId(user_id)
        }
        
        result = await self.collection.delete_one(query)
        return result.deleted_count > 0

    async def get_scan_history_by_scan_id(self, user_id: str, scan_id: str) -> Optional[ScanHistoryDetailResponse]:
        """Get scan history by original scan ID"""
        
        query = {
            "scan_id": scan_id,
            "user_id": ObjectId(user_id)
        }
        
        doc = await self.collection.find_one(query)
        
        if not doc:
            return None
        
        # Convert ObjectId to string for response
        doc["id"] = str(doc["_id"])
        doc["user_id"] = str(doc["user_id"])
        
        return ScanHistoryDetailResponse(**doc)

    def extract_scan_metrics_from_results(self, scan_results: Dict[str, Any]) -> Dict[str, int]:
        """Extract scan metrics from scan results for storage"""
        
        metrics = {
            "total_findings": 0,
            "critical_findings": 0,
            "high_findings": 0,
            "medium_findings": 0,
            "low_findings": 0
        }
        
        if not scan_results:
            return metrics
        
        # Extract from findings if available
        findings = scan_results.get("findings", [])
        if findings:
            metrics["total_findings"] = len(findings)
            
            for finding in findings:
                severity = finding.get("severity", "").lower()
                if severity == "critical":
                    metrics["critical_findings"] += 1
                elif severity == "high":
                    metrics["high_findings"] += 1
                elif severity == "medium":
                    metrics["medium_findings"] += 1
                elif severity == "low":
                    metrics["low_findings"] += 1
        
        # Also check severity_distribution if available
        severity_dist = scan_results.get("severity_distribution", {})
        if severity_dist:
            metrics["critical_findings"] = severity_dist.get("critical", 0)
            metrics["high_findings"] = severity_dist.get("high", 0)
            metrics["medium_findings"] = severity_dist.get("medium", 0)
            metrics["low_findings"] = severity_dist.get("low", 0)
            metrics["total_findings"] = sum(severity_dist.values())
        
        return metrics

    def determine_scan_status(self, scan_results: Dict[str, Any]) -> str:
        """Determine scan status based on results"""
        
        if not scan_results:
            return "error"
        
        total_findings = scan_results.get("total_findings", 0)
        critical_findings = scan_results.get("severity_distribution", {}).get("critical", 0)
        
        if critical_findings > 0:
            return "error"  # Critical issues found
        elif total_findings > 0:
            return "warning"  # Some issues found
        else:
            return "success"  # No issues found


# Global service instance and helper function
_scan_history_service = None

async def get_scan_history_service() -> ScanHistoryService:
    """Get the global scan history service instance"""
    global _scan_history_service
    if _scan_history_service is None:
        from app.core.database import get_database
        database = await get_database()
        _scan_history_service = ScanHistoryService(database)
    return _scan_history_service

async def save_scan_to_history(
    user_id: str, 
    scan_response: Union[Dict[str, Any], Any], 
    input_type: str, 
    input_size: Optional[int] = None
) -> ScanHistoryInDB:
    """
    Helper function to save scan results to history
    This is the function that scanner endpoints will call
    """
    service = await get_scan_history_service()
    
    # Convert Pydantic model to dictionary if needed
    if hasattr(scan_response, 'dict'):
        scan_response_dict = scan_response.dict()
    else:
        scan_response_dict = scan_response
    
    # Extract metrics from scan response
    metrics = service.extract_scan_metrics_from_results(scan_response_dict)
    status = service.determine_scan_status(scan_response_dict)
    
    # Create scan history data
    scan_data = ScanHistoryCreate(
        scan_id=scan_response_dict.get("scan_id", ""),
        scan_type=input_type,
        title=f"{input_type.replace('_', ' ').title()} Scan - {scan_response_dict.get('scan_id', 'Unknown')[:8]}",
        description=f"Scan performed on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
        input_size=input_size or 0,
        status=status,
        total_findings=metrics["total_findings"],
        critical_findings=metrics["critical_findings"],
        high_findings=metrics["high_findings"],
        medium_findings=metrics["medium_findings"],
        low_findings=metrics["low_findings"],
        scan_results=scan_response_dict,
        executive_summary=scan_response_dict.get("executive_summary", {}).get("risk_level", "Unknown") if isinstance(scan_response_dict.get("executive_summary"), dict) else None,
        recommendations=scan_response_dict.get("recommendations", []) if scan_response_dict.get("recommendations") else None
    )
    
    return await service.create_scan_history(user_id, scan_data)