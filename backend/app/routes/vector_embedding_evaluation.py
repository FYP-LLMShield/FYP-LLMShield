"""
Vector Embedding Evaluation Routes
==================================
Routes for comprehensive vector embedding evaluation including:
- Hit Rate, MRR, nDCG calculations
- Drift detection
- Query performance analysis
- Cluster detection
- Orphan document detection
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from io import BytesIO
import json
import logging
import uuid

from app.services.vector_embedding_evaluator import (
    vector_embedding_evaluator,
    QueryResult,
    EvaluationMetrics,
    ChunkLengthDistribution,
    DriftDetection,
    PoorPerformingQuery,
    OrphanDocument,
    DuplicateCluster
)
from app.utils.auth import get_optional_user
from app.models.user import UserInDB

logger = logging.getLogger(__name__)

router = APIRouter()

# Response Models
class QueryResultResponse(BaseModel):
    query_id: str
    query_text: str
    retrieved_vectors: List[str]
    relevance_scores: List[float]
    similarity_scores: List[float]
    hit: bool
    rank_of_first_hit: Optional[int]
    ndcg_score: float

class EvaluationMetricsResponse(BaseModel):
    hit_rate: float
    mrr: float
    ndcg: float
    total_queries: int
    processed_queries: int

class ChunkLengthDistributionResponse(BaseModel):
    bins: List[str]
    counts: List[int]
    mean: float
    median: float
    std: float
    min: int
    max: int

class DriftDetectionResponse(BaseModel):
    drift_score: float
    drift_detected: bool
    baseline_period: str
    current_period: str
    metric_changes: Dict[str, float]
    recommendations: List[str]

class PoorPerformingQueryResponse(BaseModel):
    query_id: str
    query_text: str
    hit_rate: float
    mrr: float
    ndcg: float
    issue: str
    suggestions: List[str]

class OrphanDocumentResponse(BaseModel):
    document_id: str
    title: str
    last_accessed: Optional[str]
    embedding_count: int
    reason: str
    action: str

class DuplicateClusterResponse(BaseModel):
    cluster_id: str
    size: int
    avg_similarity: float
    representative_text: str
    sources: List[str]
    vector_ids: List[str]
    action: str

class EvaluationRequest(BaseModel):
    collection_name: str = Field(..., description="Name of the vector collection")
    embedding_model: str = Field(default="text-embedding-3-large", description="Embedding model to use")
    k: int = Field(default=10, description="Top-K results to retrieve")
    chunk_size: Optional[int] = Field(default=None, description="Chunk size for analysis")
    overlap: Optional[int] = Field(default=None, description="Chunk overlap for analysis")
    reranker_enabled: bool = Field(default=False, description="Whether reranker is enabled")

class EvaluationResponse(BaseModel):
    evaluation_id: str
    collection_name: str
    embedding_model: str
    evaluation_timestamp: str
    metrics: EvaluationMetricsResponse
    chunk_length_distribution: Optional[ChunkLengthDistributionResponse] = None
    drift_detection: Optional[DriftDetectionResponse] = None
    poor_performing_queries: List[PoorPerformingQueryResponse]
    orphan_documents: List[OrphanDocumentResponse]
    duplicate_clusters: List[DuplicateClusterResponse]
    query_results: List[QueryResultResponse]
    top_k_scores: Dict[str, float]  # Scores for different K values
    recommendations: List[str]

@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_embeddings(
    vectors_file: UploadFile = File(...),
    collection_name: str = Form(...),
    embedding_model: str = Form("text-embedding-3-large"),
    k: int = Form(10),
    chunk_size: Optional[int] = Form(None),
    overlap: Optional[int] = Form(None),
    reranker_enabled: bool = Form(False),
    queries_file: Optional[UploadFile] = File(None),
    current_user: Optional[UserInDB] = Depends(get_optional_user)
):
    """
    Comprehensive vector embedding evaluation endpoint.
    
    Accepts:
    - Collection configuration (name, model, K)
    - Vector store snapshot (JSON file)
    - Query set (JSON file with queries and relevant vector IDs)
    
    Returns:
    - Hit Rate, MRR, nDCG metrics
    - Chunk length distribution
    - Drift detection results
    - Poor performing queries
    - Orphan documents
    - Duplicate clusters
    """
    evaluation_id = str(uuid.uuid4())
    
    try:
        # Load vectors from file
        vectors = []
        if vectors_file:
            content = await vectors_file.read()
            data = json.loads(content)
            if isinstance(data, dict) and 'vectors' in data:
                vectors = data['vectors']
            elif isinstance(data, list):
                vectors = data
            else:
                raise HTTPException(status_code=400, detail="Invalid vector file format")
        else:
            # For demo purposes, use sample data if no file provided
            raise HTTPException(status_code=400, detail="Vector file is required")
        
        # Load queries from file (optional - can use sample queries)
        queries = []
        if queries_file:
            content = await queries_file.read()
            data = json.loads(content)
            if isinstance(data, dict) and 'queries' in data:
                queries = data['queries']
            elif isinstance(data, list):
                queries = data
            else:
                raise HTTPException(status_code=400, detail="Invalid query file format")
        else:
            # Generate sample queries from vectors if none provided
            queries = []
            for i, vec in enumerate(vectors[:10]):  # Use first 10 vectors as queries
                metadata = vec.get('metadata', {})
                text = metadata.get('text', '')
                if text:
                    queries.append({
                        'query_id': f'query_{i}',
                        'query_text': text[:200],  # Use first 200 chars
                        'relevant_vector_ids': [vec.get('vector_id', '')]
                    })
        
        if not queries:
            raise HTTPException(status_code=400, detail="No queries available for evaluation")
        
        # Run evaluation
        query_results, metrics = vector_embedding_evaluator.evaluate_queries(
            queries=queries,
            vectors=vectors,
            k=k,
            embedding_model=embedding_model
        )
        
        # Analyze chunk length distribution
        chunk_dist = vector_embedding_evaluator.analyze_chunk_length_distribution(vectors)
        
        # Identify poor performing queries
        poor_queries = vector_embedding_evaluator.identify_poor_performing_queries(query_results)
        
        # Detect orphan documents
        orphans = vector_embedding_evaluator.detect_orphan_documents(vectors)
        
        # Detect duplicate clusters
        duplicate_clusters = vector_embedding_evaluator.detect_duplicate_clusters(vectors)
        
        # Calculate top-K scores for different K values
        top_k_scores = {}
        for k_val in [1, 2, 3, 5, 10, 20]:
            _, temp_metrics = vector_embedding_evaluator.evaluate_queries(
                queries=queries,
                vectors=vectors,
                k=k_val,
                embedding_model=embedding_model
            )
            top_k_scores[f"hit_rate@{k_val}"] = temp_metrics.hit_rate
            top_k_scores[f"mrr@{k_val}"] = temp_metrics.mrr
            top_k_scores[f"ndcg@{k_val}"] = temp_metrics.ndcg
        
        # Generate recommendations
        recommendations = []
        if metrics.hit_rate < 0.7:
            recommendations.append("Hit rate is below optimal. Consider improving query quality or embedding model.")
        if metrics.mrr < 0.5:
            recommendations.append("MRR is low. Review ranking algorithm and relevance scoring.")
        if len(poor_queries) > len(queries) * 0.3:
            recommendations.append(f"High number of poor performing queries ({len(poor_queries)}). Review query formulation.")
        if len(orphans) > 0:
            recommendations.append(f"Found {len(orphans)} orphan documents. Review chunking strategy.")
        if len(duplicate_clusters) > 0:
            recommendations.append(f"Found {len(duplicate_clusters)} duplicate clusters. Consider deduplication.")
        
        if not recommendations:
            recommendations.append("Evaluation completed successfully. No major issues detected.")
        
        # Drift detection: no baseline for single run - report stable
        drift_detection = DriftDetectionResponse(
            drift_score=0.0,
            drift_detected=False,
            baseline_period="N/A (single run)",
            current_period="current",
            metric_changes={"hit_rate": 0.0, "mrr": 0.0, "ndcg": 0.0},
            recommendations=["Run evaluations periodically and use /detect-drift to compare baseline vs current metrics."]
        )
        
        # Convert to response models
        return EvaluationResponse(
            evaluation_id=evaluation_id,
            collection_name=collection_name,
            embedding_model=embedding_model,
            evaluation_timestamp=datetime.now().isoformat(),
            metrics=EvaluationMetricsResponse(
                hit_rate=metrics.hit_rate,
                mrr=metrics.mrr,
                ndcg=metrics.ndcg,
                total_queries=metrics.total_queries,
                processed_queries=metrics.processed_queries
            ),
            chunk_length_distribution=ChunkLengthDistributionResponse(
                bins=chunk_dist.bins,
                counts=chunk_dist.counts,
                mean=chunk_dist.mean,
                median=chunk_dist.median,
                std=chunk_dist.std,
                min=chunk_dist.min,
                max=chunk_dist.max
            ),
            poor_performing_queries=[
                PoorPerformingQueryResponse(
                    query_id=pq.query_id,
                    query_text=pq.query_text,
                    hit_rate=pq.hit_rate,
                    mrr=pq.mrr,
                    ndcg=pq.ndcg,
                    issue=pq.issue,
                    suggestions=pq.suggestions
                )
                for pq in poor_queries
            ],
            orphan_documents=[
                OrphanDocumentResponse(
                    document_id=od.document_id,
                    title=od.title,
                    last_accessed=od.last_accessed,
                    embedding_count=od.embedding_count,
                    reason=od.reason,
                    action=od.action
                )
                for od in orphans
            ],
            duplicate_clusters=[
                DuplicateClusterResponse(
                    cluster_id=dc.cluster_id,
                    size=dc.size,
                    avg_similarity=dc.avg_similarity,
                    representative_text=dc.representative_text,
                    sources=dc.sources,
                    vector_ids=dc.vector_ids,
                    action=dc.action
                )
                for dc in duplicate_clusters
            ],
            query_results=[
                QueryResultResponse(
                    query_id=qr.query_id,
                    query_text=qr.query_text,
                    retrieved_vectors=qr.retrieved_vectors,
                    relevance_scores=qr.relevance_scores,
                    similarity_scores=qr.similarity_scores,
                    hit=qr.hit,
                    rank_of_first_hit=qr.rank_of_first_hit,
                    ndcg_score=qr.ndcg_score
                )
                for qr in query_results
            ],
            top_k_scores=top_k_scores,
            recommendations=recommendations,
            drift_detection=drift_detection
        )
    
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in file: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")
    except Exception as e:
        logger.error(f"Error during evaluation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.post("/detect-drift")
async def detect_drift(
    baseline_metrics: Dict[str, float] = Form(...),
    current_metrics: Dict[str, float] = Form(...),
    current_user: Optional[UserInDB] = Depends(get_optional_user)
):
    """
    Detect drift between baseline and current metrics.
    
    Accepts baseline and current metrics as JSON strings.
    """
    try:
        # Parse JSON if provided as strings
        if isinstance(baseline_metrics, str):
            baseline_metrics = json.loads(baseline_metrics)
        if isinstance(current_metrics, str):
            current_metrics = json.loads(current_metrics)
        
        drift = vector_embedding_evaluator.detect_drift(baseline_metrics, current_metrics)
        
        return DriftDetectionResponse(
            drift_score=drift.drift_score,
            drift_detected=drift.drift_detected,
            baseline_period=drift.baseline_period,
            current_period=drift.current_period,
            metric_changes=drift.metric_changes,
            recommendations=drift.recommendations
        )
    except Exception as e:
        logger.error(f"Error during drift detection: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Drift detection failed: {str(e)}")


@router.post("/analyze-chunks")
async def analyze_chunk_distribution(
    vectors_file: UploadFile = File(...),
    current_user: Optional[UserInDB] = Depends(get_optional_user)
):
    """
    Analyze chunk length distribution from vector store snapshot.
    """
    try:
        content = await vectors_file.read()
        data = json.loads(content)
        
        if isinstance(data, dict) and 'vectors' in data:
            vectors = data['vectors']
        elif isinstance(data, list):
            vectors = data
        else:
            raise HTTPException(status_code=400, detail="Invalid vector file format")
        
        chunk_dist = vector_embedding_evaluator.analyze_chunk_length_distribution(vectors)
        
        return ChunkLengthDistributionResponse(
            bins=chunk_dist.bins,
            counts=chunk_dist.counts,
            mean=chunk_dist.mean,
            median=chunk_dist.median,
            std=chunk_dist.std,
            min=chunk_dist.min,
            max=chunk_dist.max
        )
    except Exception as e:
        logger.error(f"Error during chunk analysis: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chunk analysis failed: {str(e)}")


@router.post("/detect-duplicates")
async def detect_duplicate_clusters(
    vectors_file: UploadFile = File(...),
    similarity_threshold: float = Form(0.9),
    min_cluster_size: int = Form(2),
    current_user: Optional[UserInDB] = Depends(get_optional_user)
):
    """
    Detect duplicate or highly similar vector clusters.
    """
    try:
        content = await vectors_file.read()
        data = json.loads(content)
        
        if isinstance(data, dict) and 'vectors' in data:
            vectors = data['vectors']
        elif isinstance(data, list):
            vectors = data
        else:
            raise HTTPException(status_code=400, detail="Invalid vector file format")
        
        clusters = vector_embedding_evaluator.detect_duplicate_clusters(
            vectors,
            similarity_threshold=similarity_threshold,
            min_cluster_size=min_cluster_size
        )
        
        return [
            DuplicateClusterResponse(
                cluster_id=dc.cluster_id,
                size=dc.size,
                avg_similarity=dc.avg_similarity,
                representative_text=dc.representative_text,
                sources=dc.sources,
                vector_ids=dc.vector_ids,
                action=dc.action
            )
            for dc in clusters
        ]
    except Exception as e:
        logger.error(f"Error during duplicate detection: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Duplicate detection failed: {str(e)}")


class ExportRequest(BaseModel):
    evaluation: Dict[str, Any]
    format: str = "json"  # "json" or "pdf"


@router.post("/export")
async def export_evaluation_report(
    request: ExportRequest,
    current_user: Optional[UserInDB] = Depends(get_optional_user)
):
    """
    Export evaluation report as JSON or PDF.
    Pass the full EvaluationResponse in request.evaluation.
    """
    payload = request.evaluation
    fmt = request.format
    try:
        if fmt == "json":
            filename = f"vector_evaluation_{payload.get('evaluation_id', 'report')}.json"
            content = json.dumps(payload, indent=2, default=str)
            return Response(
                content=content,
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        elif fmt == "pdf":
            pdf_bytes = _generate_evaluation_pdf(payload)
            filename = f"vector_evaluation_{payload.get('evaluation_id', 'report')}.pdf"
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:
            raise HTTPException(status_code=400, detail="format must be 'json' or 'pdf'")
    except Exception as e:
        logger.error(f"Export failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


def _generate_evaluation_pdf(data: Dict[str, Any]) -> bytes:
    """Generate PDF report for vector embedding evaluation."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=inch, leftMargin=inch, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(name="Title", parent=styles["Heading1"], fontSize=18, spaceAfter=12)
    story = []

    story.append(Paragraph("Vector Embedding Evaluation Report", title_style))
    story.append(Spacer(1, 12))

    ev_id = data.get("evaluation_id", "N/A")
    coll = data.get("collection_name", "N/A")
    model = data.get("embedding_model", "N/A")
    ts = data.get("evaluation_timestamp", "N/A")
    story.append(Paragraph(f"<b>Evaluation ID:</b> {ev_id}", styles["Normal"]))
    story.append(Paragraph(f"<b>Collection:</b> {coll}", styles["Normal"]))
    story.append(Paragraph(f"<b>Embedding Model:</b> {model}", styles["Normal"]))
    story.append(Paragraph(f"<b>Timestamp:</b> {ts}", styles["Normal"]))
    story.append(Spacer(1, 16))

    metrics = data.get("metrics", {})
    if metrics:
        story.append(Paragraph("Metrics", styles["Heading2"]))
        table_data = [
            ["Metric", "Value"],
            ["Hit Rate", f"{(metrics.get('hit_rate', 0) * 100):.1f}%"],
            ["MRR", f"{metrics.get('mrr', 0):.3f}"],
            ["nDCG", f"{metrics.get('ndcg', 0):.3f}"],
            ["Queries Processed", str(metrics.get('processed_queries', 0))],
        ]
        t = Table(table_data, colWidths=[3 * inch, 2 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
            ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        story.append(t)
        story.append(Spacer(1, 16))

    recs = data.get("recommendations", [])
    if recs:
        story.append(Paragraph("Recommendations", styles["Heading2"]))
        for r in recs:
            story.append(Paragraph(f"• {r}", styles["Normal"]))
        story.append(Spacer(1, 12))

    doc.build(story)
    return buffer.getvalue()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "vector_embedding_evaluation",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }
