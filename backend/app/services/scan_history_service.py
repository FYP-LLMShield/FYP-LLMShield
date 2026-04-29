"""
Scan History Service
Handles saving and retrieving scan history for users
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Union
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.scan_history import (
    ScanHistoryCreate, 
    ScanHistoryInDB, 
    ScanHistoryResponse, 
    ScanHistoryDetailResponse
)


def _model_to_dict(obj: Any) -> Dict[str, Any]:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return dict(obj)
    if hasattr(obj, "model_dump"):
        return obj.model_dump()  # type: ignore[no-untyped-call]
    if hasattr(obj, "dict"):
        return obj.dict()  # type: ignore[no-untyped-call]
    return {"_value": str(obj)}


def human_module_title(module: str) -> str:
    return {
        "code_scanning": "Code scan",
        "prompt_injection": "Prompt injection",
        "data_poisoning": "Data poisoning",
        "vector_security": "Vector / anomaly",
        "embedding_inspection": "Embedding inspection",
        "retrieval_simulation": "Retrieval attack",
    }.get(module, module.replace("_", " ").title())


def trim_history_payload(d: Dict[str, Any], scan_module: str) -> Dict[str, Any]:
    """Strip oversized lists before persisting to MongoDB."""
    out = dict(d)
    out.pop("chunks", None)
    findings = out.get("findings")
    if isinstance(findings, list) and len(findings) > 200:
        out["findings"] = findings[:200]
        out["_findings_omitted"] = len(findings) - 200
    qs = out.get("query_summaries")
    if isinstance(qs, list) and len(qs) > 200:
        out["query_summaries"] = qs[:200]
        out["_query_summaries_omitted"] = len(qs) - 200
    beh = out.get("behavioral_impacts")
    if isinstance(beh, list) and len(beh) > 50:
        out["behavioral_impacts"] = beh[:50]
    r = out.get("results")
    if isinstance(r, list) and len(r) > 30:
        out["results"] = r[:30]
        out["_results_omitted"] = len(r) - 30
    if scan_module == "embedding_inspection":
        out.pop("chunks", None)
    return out


def model_to_storable_dict(obj: Any, scan_module: str) -> Dict[str, Any]:
    return trim_history_payload(_model_to_dict(obj), scan_module)


class ScanHistoryService:
    def __init__(self, database: AsyncIOMotorDatabase):
        self.database = database
        self.collection = database.scan_history

    async def create_scan_history(self, user_id: str, scan_data: ScanHistoryCreate) -> ScanHistoryInDB:
        """Create a new scan history entry for a user"""
        user_oid = ObjectId(user_id)

        # Idempotency guard: when scan_id is present, treat same user+module+scan_id as one run.
        scan_id = (scan_data.scan_id or "").strip()
        if scan_id:
            existing = await self.collection.find_one(
                {
                    "user_id": user_oid,
                    "scan_type": scan_data.scan_type,
                    "scan_id": scan_id,
                },
                sort=[("timestamp", -1)],
            )
            if existing:
                return ScanHistoryInDB(**existing)

        # Fallback dedupe for legacy/empty scan_id flows.
        # If backend auto-save and frontend saveHistory fire for the same run, they arrive seconds apart
        # with near-identical metrics. Collapse only very-recent duplicates to avoid double history rows.
        now = datetime.utcnow()
        recent_duplicate = await self.collection.find_one(
            {
                "user_id": user_oid,
                "scan_type": scan_data.scan_type,
                "input_type": scan_data.input_type,
                "status": scan_data.status,
                "total_findings": scan_data.total_findings,
                "critical_findings": scan_data.critical_findings,
                "high_findings": scan_data.high_findings,
                "medium_findings": scan_data.medium_findings,
                "low_findings": scan_data.low_findings,
                "timestamp": {"$gte": now - timedelta(seconds=8)},
            },
            sort=[("timestamp", -1)],
        )
        if recent_duplicate:
            return ScanHistoryInDB(**recent_duplicate)

        scan_history = ScanHistoryInDB(
            user_id=user_oid,
            **scan_data.dict()
        )
        
        # Insert into database
        result = await self.collection.insert_one(scan_history.dict(by_alias=True))
        
        # Return the created scan history with the generated ID
        scan_history.id = result.inserted_id
        return scan_history

    def _input_type_filter_clause(self, input_type: str) -> Dict[str, Any]:
        """Match canonical input_type (text|file|github) and legacy values stored on scan_type."""
        if input_type == "file":
            return {
                "$or": [
                    {"input_type": "file"},
                    {"input_type": "file_upload"},
                    {"scan_type": "file"},
                    {"scan_type": "file_upload"},
                ]
            }
        if input_type == "github":
            return {
                "$or": [
                    {"input_type": "github"},
                    {"scan_type": "github"},
                    {"scan_type": "github_repo"},
                ]
            }
        if input_type == "text":
            return {"$or": [{"input_type": "text"}, {"scan_type": "text"}]}
        if input_type == "json":
            return {"$or": [{"input_type": "json"}, {"scan_type": "json"}]}
        if input_type == "other":
            return {"input_type": "other"}
        return {"input_type": input_type}

    async def get_user_scan_history(
        self, 
        user_id: str, 
        limit: int = 50, 
        skip: int = 0,
        scan_type: Optional[str] = None,
        status: Optional[str] = None,
        input_type: Optional[str] = None,
    ) -> List[ScanHistoryResponse]:
        """Get scan history for a specific user with optional filtering"""
        
        # Build query filter
        query: Dict[str, Any] = {"user_id": ObjectId(user_id)}
        
        if scan_type:
            query["scan_type"] = scan_type
        
        if status:
            query["status"] = status

        if input_type:
            clause = self._input_type_filter_clause(input_type)
            query = {"$and": [query, clause]}
        
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
        status: Optional[str] = None,
        input_type: Optional[str] = None,
    ) -> int:
        """Get total count of scan history for a specific user with optional filtering"""
        
        # Build query filter
        query: Dict[str, Any] = {"user_id": ObjectId(user_id)}
        
        if scan_type:
            query["scan_type"] = scan_type
        
        if status:
            query["status"] = status

        if input_type:
            clause = self._input_type_filter_clause(input_type)
            query = {"$and": [query, clause]}
        
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

    async def get_user_scan_stats(
        self,
        user_id: str,
        input_type: Optional[str] = None,
        scan_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Aggregate stats; optional input_type and scan_type (module) match list filters."""
        parts: List[Dict[str, Any]] = [{"user_id": ObjectId(user_id)}]
        if scan_type:
            parts.append({"scan_type": scan_type})
        if input_type:
            parts.append(self._input_type_filter_clause(input_type))
        if len(parts) == 1:
            match_q = parts[0]
        else:
            match_q = {"$and": parts}

        pipeline = [
            {"$match": match_q},
            {
                "$group": {
                    "_id": None,
                    "total_scans": {"$sum": 1},
                    "total_findings": {"$sum": "$total_findings"},
                    "critical_findings": {"$sum": "$critical_findings"},
                    "high_findings": {"$sum": "$high_findings"},
                    "medium_findings": {"$sum": "$medium_findings"},
                    "low_findings": {"$sum": "$low_findings"},
                    "clean_scans": {
                        "$sum": {"$cond": [{"$eq": ["$total_findings", 0]}, 1, 0]}
                    },
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
                "clean_scans": 0,
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
        """Extract scan metrics from heterogeneous scan result payloads for storage."""
        metrics = {
            "total_findings": 0,
            "critical_findings": 0,
            "high_findings": 0,
            "medium_findings": 0,
            "low_findings": 0,
        }
        if not scan_results:
            return metrics

        # Severity distribution (code scanner, some vector flows)
        severity_dist = scan_results.get("severity_distribution", {})
        if isinstance(severity_dist, dict) and severity_dist:
            metrics["critical_findings"] = int(severity_dist.get("critical", 0) or 0)
            metrics["high_findings"] = int(severity_dist.get("high", 0) or 0)
            metrics["medium_findings"] = int(severity_dist.get("medium", 0) or 0)
            metrics["low_findings"] = int(severity_dist.get("low", 0) or 0)
            metrics["total_findings"] = int(sum(int(v) for v in severity_dist.values()))
            return metrics

        # Findings list (C/C++ hybrid, vector anomalies, retrieval, embedding)
        findings = scan_results.get("findings", [])
        if isinstance(findings, list) and findings:
            meta = scan_results.get("summary")
            if isinstance(meta, dict) and meta.get("severity_counts") and not any(
                isinstance(f, dict) and f.get("severity") for f in findings
            ):
                sc = meta.get("severity_counts", {})
                metrics["high_findings"] = int(sc.get("high", 0) or 0)
                metrics["medium_findings"] = int(sc.get("medium", 0) or 0)
                metrics["low_findings"] = int(sc.get("low", 0) or 0)
                metrics["total_findings"] = int(meta.get("total_findings", len(findings)) or 0)
                return metrics
            metrics["total_findings"] = len(findings)
            for finding in findings:
                if not isinstance(finding, dict):
                    continue
                sev = (finding.get("severity") or finding.get("risk") or "").lower()
                if sev in ("critical", "crit") or float(finding.get("severity_score", 0) or 0) >= 4.5:
                    metrics["critical_findings"] += 1
                elif sev == "high" or float(finding.get("severity_score", 0) or 0) >= 3.5:
                    metrics["high_findings"] += 1
                elif sev == "medium" or (finding.get("risk_score") is not None and 0.5 <= float(finding.get("risk_score", 0)) < 0.8):
                    metrics["medium_findings"] += 1
                else:
                    metrics["low_findings"] += 1
            if metrics["total_findings"] and (metrics["high_findings"] + metrics["medium_findings"] + metrics["low_findings"] + metrics["critical_findings"] == 0):
                # No per-item severity: treat as medium signal count
                metrics["medium_findings"] = metrics["total_findings"]
            return metrics

        # LLM Shield data-poisoning
        if scan_results.get("poisoned_count") is not None:
            try:
                pc = int(scan_results.get("poisoned_count", 0) or 0)
            except (TypeError, ValueError):
                pc = 0
            metrics["total_findings"] = pc
            metrics["high_findings"] = pc
            return metrics
        if scan_results.get("is_poisoned") is True:
            metrics["total_findings"] = 1
            metrics["high_findings"] = 1
            return metrics

        # Prompt-injection: violations_found
        vio = scan_results.get("violations_found")
        if vio is not None:
            try:
                v = int(vio)
            except (TypeError, ValueError):
                v = 0
            metrics["total_findings"] = v
            if v > 0:
                metrics["high_findings"] = v
            return metrics

        sm = scan_results.get("summary")
        if isinstance(sm, dict) and sm.get("total_findings") is not None:
            try:
                tf = int(sm.get("total_findings", 0) or 0)
            except (TypeError, ValueError):
                tf = 0
            if tf > 0:
                metrics["total_findings"] = tf
                sc = sm.get("severity_counts")
                if isinstance(sc, dict) and sc:
                    metrics["high_findings"] = int(sc.get("high", 0) or 0)
                    metrics["medium_findings"] = int(sc.get("medium", 0) or 0)
                    metrics["low_findings"] = int(sc.get("low", 0) or 0)
                else:
                    metrics["medium_findings"] = tf

        if scan_results.get("total_findings") is not None and metrics["total_findings"] == 0:
            try:
                metrics["total_findings"] = int(scan_results.get("total_findings", 0) or 0)
            except (TypeError, ValueError):
                pass

        return metrics

    def determine_scan_status(
        self, scan_results: Dict[str, Any], precomputed: Optional[Dict[str, int]] = None
    ) -> str:
        if not scan_results:
            return "error"
        m = precomputed or self.extract_scan_metrics_from_results(scan_results)
        if m.get("critical_findings", 0) > 0:
            return "error"
        if m.get("total_findings", 0) > 0:
            return "warning"
        return "success"


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
    input_size: Optional[int] = None,
    scan_module: str = "code_scanning",
) -> ScanHistoryInDB:
    """
    Save scan / analysis results to per-user history.
    scan_module: e.g. code_scanning, prompt_injection, data_poisoning, vector_security, embedding_inspection, retrieval_simulation
    input_type: channel, e.g. text, file, file_upload, github, json
    """
    service = await get_scan_history_service()

    scan_response_dict = model_to_storable_dict(scan_response, scan_module)

    metrics = service.extract_scan_metrics_from_results(scan_response_dict)
    status = service.determine_scan_status(scan_response_dict, metrics)

    if scan_module == "code_scanning":
        canonical_input = (
            "text"
            if input_type == "text"
            else "file"
            if input_type in ("file", "file_upload")
            else "github"
            if input_type in ("github", "github_repo")
            else input_type
        )
    else:
        if input_type in ("text", "file", "github", "json", "multi", "file_upload", "github_repo"):
            canonical_input = "file" if input_type in ("file", "file_upload") else "github" if input_type in ("github", "github_repo") else input_type
        else:
            canonical_input = "other"

    scan_id = (
        scan_response_dict.get("scan_id")
        or scan_response_dict.get("test_id")
        or ""
    )
    short_id = (scan_id or "unknown")[:8]
    mod_title = human_module_title(scan_module)
    title = f"{mod_title} · {short_id}"

    scan_data = ScanHistoryCreate(
        scan_id=scan_id,
        scan_type=scan_module,
        title=title,
        description=f"Recorded at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC",
        input_type=canonical_input,
        input_size=input_size or 0,
        status=status,
        total_findings=metrics["total_findings"],
        critical_findings=metrics["critical_findings"],
        high_findings=metrics["high_findings"],
        medium_findings=metrics["medium_findings"],
        low_findings=metrics["low_findings"],
        scan_results=scan_response_dict,
        executive_summary=(
            scan_response_dict.get("executive_summary", {}).get("risk_level", "Unknown")
            if isinstance(scan_response_dict.get("executive_summary"), dict)
            else (str(scan_response_dict.get("message")) if scan_response_dict.get("message") else None)
        ),
        recommendations=(
            scan_response_dict.get("recommendations", [])
            if scan_response_dict.get("recommendations")
            else None
        ),
    )

    return await service.create_scan_history(user_id, scan_data)