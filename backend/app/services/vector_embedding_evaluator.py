"""
Vector Embedding Evaluation Service
------------------------------------
Comprehensive evaluation service for vector embeddings including:
- Hit Rate, MRR, nDCG calculations
- Drift detection
- Query performance analysis
- Cluster detection
- Orphan document detection
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy.linalg import norm
from scipy import stats
from scipy.spatial.distance import cosine

try:
    from sklearn.cluster import DBSCAN
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.preprocessing import StandardScaler
except ImportError:
    DBSCAN = None
    cosine_similarity = None
    StandardScaler = None


@dataclass
class QueryResult:
    """Result for a single query"""
    query_id: str
    query_text: str
    retrieved_vectors: List[str]  # Vector IDs in order
    relevance_scores: List[float]  # Ground truth relevance (0 or 1)
    similarity_scores: List[float]  # Similarity scores from retrieval
    hit: bool  # Whether at least one relevant result in top-K
    rank_of_first_hit: Optional[int]  # Rank of first relevant result (1-indexed)
    ndcg_score: float  # nDCG@K score


@dataclass
class EvaluationMetrics:
    """Aggregated evaluation metrics"""
    hit_rate: float
    mrr: float  # Mean Reciprocal Rank
    ndcg: float  # Normalized Discounted Cumulative Gain
    total_queries: int
    processed_queries: int


@dataclass
class ChunkLengthDistribution:
    """Chunk length distribution statistics"""
    bins: List[str]  # e.g., ["0-100", "100-200", ...]
    counts: List[int]
    mean: float
    median: float
    std: float
    min: int
    max: int


@dataclass
class DriftDetection:
    """Drift detection results"""
    drift_score: float  # 0-1, higher = more drift
    drift_detected: bool
    baseline_period: str
    current_period: str
    metric_changes: Dict[str, float]  # Changes in metrics over time
    recommendations: List[str]


@dataclass
class PoorPerformingQuery:
    """Information about a poorly performing query"""
    query_id: str
    query_text: str
    hit_rate: float
    mrr: float
    ndcg: float
    issue: str
    suggestions: List[str]


@dataclass
class OrphanDocument:
    """Document with no or very few embeddings"""
    document_id: str
    title: str
    last_accessed: Optional[str]
    embedding_count: int
    reason: str
    action: str


@dataclass
class DuplicateCluster:
    """Cluster of duplicate or highly similar vectors"""
    cluster_id: str
    size: int
    avg_similarity: float
    representative_text: str
    sources: List[str]
    vector_ids: List[str]
    action: str


class VectorEmbeddingEvaluator:
    """Main evaluation service for vector embeddings"""
    
    def __init__(self):
        self.supported_embedding_models = [
            "text-embedding-3-large",
            "text-embedding-3-small",
            "text-embedding-ada-002"
        ]
    
    def calculate_hit_rate(self, query_results: List[QueryResult]) -> float:
        """Calculate Hit Rate@K"""
        if not query_results:
            return 0.0
        hits = sum(1 for qr in query_results if qr.hit)
        return hits / len(query_results)
    
    def calculate_mrr(self, query_results: List[QueryResult]) -> float:
        """Calculate Mean Reciprocal Rank"""
        if not query_results:
            return 0.0
        reciprocal_ranks = []
        for qr in query_results:
            if qr.rank_of_first_hit is not None:
                reciprocal_ranks.append(1.0 / qr.rank_of_first_hit)
            else:
                reciprocal_ranks.append(0.0)
        return sum(reciprocal_ranks) / len(reciprocal_ranks) if reciprocal_ranks else 0.0
    
    def calculate_ndcg(self, query_results: List[QueryResult], k: int = 10) -> float:
        """Calculate average nDCG@K across all queries"""
        if not query_results:
            return 0.0
        ndcg_scores = [qr.ndcg_score for qr in query_results]
        return sum(ndcg_scores) / len(ndcg_scores) if ndcg_scores else 0.0
    
    def calculate_ndcg_for_query(
        self,
        relevance_scores: List[float],
        similarity_scores: List[float],
        k: int = 10
    ) -> float:
        """Calculate nDCG@K for a single query"""
        if not relevance_scores or not similarity_scores:
            return 0.0
        
        # Take top K
        k = min(k, len(relevance_scores))
        
        # Sort by similarity scores (descending)
        sorted_pairs = sorted(
            zip(relevance_scores, similarity_scores),
            key=lambda x: x[1],
            reverse=True
        )[:k]
        
        # Calculate DCG
        dcg = sum(
            rel / math.log2(i + 2)  # i+2 because rank is 1-indexed
            for i, (rel, _) in enumerate(sorted_pairs)
        )
        
        # Calculate IDCG (ideal DCG - sorted by relevance)
        ideal_sorted = sorted(relevance_scores, reverse=True)[:k]
        idcg = sum(
            rel / math.log2(i + 2)
            for i, rel in enumerate(ideal_sorted)
        )
        
        # nDCG = DCG / IDCG
        return dcg / idcg if idcg > 0 else 0.0
    
    def evaluate_queries(
        self,
        queries: List[Dict[str, Any]],
        vectors: List[Dict[str, Any]],
        k: int = 10,
        embedding_model: str = "text-embedding-3-large"
    ) -> Tuple[List[QueryResult], EvaluationMetrics]:
        """
        Evaluate queries against vectors
        
        Args:
            queries: List of query dicts with 'query_id', 'query_text', 'relevant_vector_ids'
            vectors: List of vector dicts with 'vector_id', 'embedding', 'metadata'
            k: Top-K results to retrieve
            embedding_model: Model name for embedding generation (if needed)
        """
        query_results = []
        
        # Create vector lookup
        vector_dict = {v['vector_id']: v for v in vectors}
        vector_embeddings = {v['vector_id']: np.array(v['embedding']) for v in vectors}
        
        for query in queries:
            query_id = query.get('query_id', f"query_{len(query_results)}")
            query_text = query.get('query_text', '')
            relevant_ids = set(query.get('relevant_vector_ids', []))
            
            # For now, simulate retrieval by computing similarities
            # In production, this would use actual vector DB retrieval
            query_embedding = self._generate_embedding(query_text, embedding_model)
            
            # Compute similarities
            similarities = []
            for vec_id, vec_emb in vector_embeddings.items():
                try:
                    sim = 1 - cosine(query_embedding, vec_emb)
                    similarities.append((vec_id, sim))
                except:
                    similarities.append((vec_id, 0.0))
            
            # Sort by similarity
            similarities.sort(key=lambda x: x[1], reverse=True)
            top_k = similarities[:k]
            
            # Extract results
            retrieved_ids = [vec_id for vec_id, _ in top_k]
            similarity_scores = [sim for _, sim in top_k]
            relevance_scores = [1.0 if vec_id in relevant_ids else 0.0 for vec_id in retrieved_ids]
            
            # Calculate metrics for this query
            hit = any(vec_id in relevant_ids for vec_id in retrieved_ids)
            rank_of_first_hit = None
            for i, vec_id in enumerate(retrieved_ids):
                if vec_id in relevant_ids:
                    rank_of_first_hit = i + 1
                    break
            
            ndcg_score = self.calculate_ndcg_for_query(relevance_scores, similarity_scores, k)
            
            query_result = QueryResult(
                query_id=query_id,
                query_text=query_text,
                retrieved_vectors=retrieved_ids,
                relevance_scores=relevance_scores,
                similarity_scores=similarity_scores,
                hit=hit,
                rank_of_first_hit=rank_of_first_hit,
                ndcg_score=ndcg_score
            )
            query_results.append(query_result)
        
        # Calculate aggregate metrics
        hit_rate = self.calculate_hit_rate(query_results)
        mrr = self.calculate_mrr(query_results)
        ndcg = self.calculate_ndcg(query_results, k)
        
        metrics = EvaluationMetrics(
            hit_rate=hit_rate,
            mrr=mrr,
            ndcg=ndcg,
            total_queries=len(queries),
            processed_queries=len(query_results)
        )
        
        return query_results, metrics
    
    def analyze_chunk_length_distribution(
        self,
        vectors: List[Dict[str, Any]]
    ) -> ChunkLengthDistribution:
        """Analyze chunk length distribution from vector metadata"""
        lengths = []
        for vec in vectors:
            metadata = vec.get('metadata', {})
            text = metadata.get('text', '')
            if text:
                lengths.append(len(text.split()))  # Word count
        
        if not lengths:
            return ChunkLengthDistribution(
                bins=[],
                counts=[],
                mean=0.0,
                median=0.0,
                std=0.0,
                min=0,
                max=0
            )
        
        # Create bins
        max_len = max(lengths)
        bin_ranges = [
            (0, 100),
            (100, 200),
            (200, 300),
            (300, 400),
            (400, 500),
            (500, float('inf'))
        ]
        
        bins = []
        counts = []
        for start, end in bin_ranges:
            if end == float('inf'):
                bins.append(f"{start}+")
                count = sum(1 for l in lengths if l >= start)
            else:
                bins.append(f"{start}-{end}")
                count = sum(1 for l in lengths if start <= l < end)
            counts.append(count)
        
        return ChunkLengthDistribution(
            bins=bins,
            counts=counts,
            mean=float(np.mean(lengths)),
            median=float(np.median(lengths)),
            std=float(np.std(lengths)),
            min=int(min(lengths)),
            max=int(max(lengths))
        )
    
    def detect_drift(
        self,
        baseline_metrics: Dict[str, float],
        current_metrics: Dict[str, float]
    ) -> DriftDetection:
        """Detect drift between baseline and current metrics"""
        metric_changes = {}
        total_change = 0.0
        
        for metric in ['hit_rate', 'mrr', 'ndcg']:
            if metric in baseline_metrics and metric in current_metrics:
                change = current_metrics[metric] - baseline_metrics[metric]
                metric_changes[metric] = change
                total_change += abs(change)
        
        # Drift score is normalized change
        drift_score = min(total_change / 3.0, 1.0)  # Max possible change is 3.0
        drift_detected = drift_score > 0.15  # Threshold
        
        recommendations = []
        if drift_detected:
            if metric_changes.get('hit_rate', 0) < -0.1:
                recommendations.append("Hit rate decreased significantly. Review query quality and embedding model.")
            if metric_changes.get('mrr', 0) < -0.1:
                recommendations.append("MRR decreased. Check ranking algorithm and relevance scoring.")
            if metric_changes.get('ndcg', 0) < -0.1:
                recommendations.append("nDCG decreased. Consider retraining embeddings or adjusting retrieval parameters.")
        else:
            recommendations.append("No significant drift detected. System performance is stable.")
        
        return DriftDetection(
            drift_score=drift_score,
            drift_detected=drift_detected,
            baseline_period="baseline",
            current_period="current",
            metric_changes=metric_changes,
            recommendations=recommendations
        )
    
    def identify_poor_performing_queries(
        self,
        query_results: List[QueryResult],
        threshold_hit_rate: float = 0.5,
        threshold_mrr: float = 0.3
    ) -> List[PoorPerformingQuery]:
        """Identify queries with poor performance"""
        poor_queries = []
        
        for qr in query_results:
            # Calculate individual query metrics
            query_hit_rate = 1.0 if qr.hit else 0.0
            query_mrr = 1.0 / qr.rank_of_first_hit if qr.rank_of_first_hit else 0.0
            
            # Check if this query is poor performing
            if query_hit_rate < threshold_hit_rate or query_mrr < threshold_mrr:
                issues = []
                suggestions = []
                
                if not qr.hit:
                    issues.append("No relevant results found")
                    suggestions.append("Review query formulation and ensure relevant documents exist")
                
                if query_mrr < 0.1:
                    issues.append("Very poor ranking")
                    suggestions.append("Improve semantic matching or adjust similarity threshold")
                
                if qr.ndcg_score < 0.3:
                    issues.append("Low relevance in top results")
                    suggestions.append("Consider query expansion or improve embedding quality")
                
                if not qr.query_text.strip():
                    issues.append("Empty query")
                    suggestions.append("Add query validation")
                
                issue_str = "; ".join(issues) if issues else "Low performance metrics"
                
                poor_query = PoorPerformingQuery(
                    query_id=qr.query_id,
                    query_text=qr.query_text,
                    hit_rate=query_hit_rate,
                    mrr=query_mrr,
                    ndcg=qr.ndcg_score,
                    issue=issue_str,
                    suggestions=suggestions if suggestions else ["Review query and retrieval configuration"]
                )
                poor_queries.append(poor_query)
        
        return poor_queries
    
    def detect_orphan_documents(
        self,
        vectors: List[Dict[str, Any]],
        min_embeddings: int = 1
    ) -> List[OrphanDocument]:
        """Detect documents with no or very few embeddings"""
        doc_embedding_count = {}
        doc_metadata = {}
        
        for vec in vectors:
            metadata = vec.get('metadata', {})
            doc_id = metadata.get('source_doc', metadata.get('document_id', 'unknown'))
            
            if doc_id not in doc_embedding_count:
                doc_embedding_count[doc_id] = 0
                doc_metadata[doc_id] = {
                    'title': metadata.get('title', doc_id),
                    'last_accessed': metadata.get('last_accessed'),
                    'label': metadata.get('label', '')
                }
            doc_embedding_count[doc_id] += 1
        
        orphans = []
        for doc_id, count in doc_embedding_count.items():
            if count < min_embeddings:
                metadata = doc_metadata[doc_id]
                reason = "No valid chunks generated" if count == 0 else f"Only {count} embedding(s) generated"
                action = "Review chunking strategy" if count == 0 else "Check chunk size and overlap settings"
                
                orphan = OrphanDocument(
                    document_id=doc_id,
                    title=metadata.get('title', doc_id),
                    last_accessed=metadata.get('last_accessed'),
                    embedding_count=count,
                    reason=reason,
                    action=action
                )
                orphans.append(orphan)
        
        return orphans
    
    def detect_duplicate_clusters(
        self,
        vectors: List[Dict[str, Any]],
        similarity_threshold: float = 0.9,
        min_cluster_size: int = 2
    ) -> List[DuplicateCluster]:
        """Detect clusters of duplicate or highly similar vectors"""
        if not vectors or len(vectors) < 2:
            return []
        
        if cosine_similarity is None or DBSCAN is None:
            # Fallback: simple pairwise comparison
            return self._simple_duplicate_detection(vectors, similarity_threshold)
        
        # Extract embeddings
        embeddings = []
        vector_metadata = []
        for vec in vectors:
            emb = np.array(vec.get('embedding', []))
            if len(emb) > 0:
                # Normalize embedding to ensure cosine similarity is valid
                emb_norm = np.linalg.norm(emb)
                if emb_norm > 0:
                    emb = emb / emb_norm
                embeddings.append(emb)
                vector_metadata.append(vec)
        
        if len(embeddings) < 2:
            return []
        
        embeddings = np.array(embeddings)
        
        # Compute similarity matrix
        similarity_matrix = cosine_similarity(embeddings)
        
        # Use DBSCAN to find clusters
        # Convert similarity to distance (1 - similarity)
        # Clip to ensure non-negative values (handle numerical precision issues)
        distance_matrix = np.clip(1 - similarity_matrix, 0, 2)
        
        # DBSCAN with eps based on similarity threshold
        eps = 1 - similarity_threshold
        clustering = DBSCAN(eps=eps, min_samples=min_cluster_size, metric='precomputed')
        cluster_labels = clustering.fit_predict(distance_matrix)
        
        # Group vectors by cluster
        clusters = {}
        for i, label in enumerate(cluster_labels):
            if label != -1:  # -1 is noise in DBSCAN
                if label not in clusters:
                    clusters[label] = []
                clusters[label].append(i)
        
        duplicate_clusters = []
        for cluster_id, indices in clusters.items():
            if len(indices) >= min_cluster_size:
                cluster_vectors = [vector_metadata[i] for i in indices]
                
                # Calculate average similarity
                similarities = []
                for i in range(len(indices)):
                    for j in range(i + 1, len(indices)):
                        sim = similarity_matrix[indices[i], indices[j]]
                        similarities.append(sim)
                
                avg_sim = float(np.mean(similarities)) if similarities else 0.0
                
                # Get representative text
                representative = cluster_vectors[0].get('metadata', {}).get('text', '')[:100]
                if not representative:
                    representative = f"Cluster {cluster_id}"
                
                # Get sources
                sources = list(set(
                    v.get('metadata', {}).get('source', v.get('metadata', {}).get('source_doc', 'unknown'))
                    for v in cluster_vectors
                ))
                
                vector_ids = [v.get('vector_id', '') for v in cluster_vectors]
                
                duplicate_cluster = DuplicateCluster(
                    cluster_id=f"CLUSTER-{cluster_id:03d}",
                    size=len(cluster_vectors),
                    avg_similarity=avg_sim,
                    representative_text=representative,
                    sources=sources,
                    vector_ids=vector_ids,
                    action="Merge similar chunks" if len(sources) > 1 else "Deduplicate content"
                )
                duplicate_clusters.append(duplicate_cluster)
        
        return duplicate_clusters
    
    def _simple_duplicate_detection(
        self,
        vectors: List[Dict[str, Any]],
        similarity_threshold: float = 0.9
    ) -> List[DuplicateCluster]:
        """Simple pairwise duplicate detection fallback"""
        clusters = []
        processed = set()
        
        for i, vec1 in enumerate(vectors):
            if i in processed:
                continue
            
            emb1 = np.array(vec1.get('embedding', []))
            if len(emb1) == 0:
                continue
            
            # Normalize embedding
            emb1_norm = np.linalg.norm(emb1)
            if emb1_norm > 0:
                emb1 = emb1 / emb1_norm
            
            cluster = [i]
            
            for j, vec2 in enumerate(vectors[i+1:], start=i+1):
                if j in processed:
                    continue
                
                emb2 = np.array(vec2.get('embedding', []))
                if len(emb2) == 0:
                    continue
                
                # Normalize embedding
                emb2_norm = np.linalg.norm(emb2)
                if emb2_norm > 0:
                    emb2 = emb2 / emb2_norm
                
                try:
                    sim = 1 - cosine(emb1, emb2)
                    if sim >= similarity_threshold:
                        cluster.append(j)
                        processed.add(j)
                except:
                    pass
            
            if len(cluster) >= 2:
                processed.update(cluster)
                cluster_vectors = [vectors[idx] for idx in cluster]
                
                representative = cluster_vectors[0].get('metadata', {}).get('text', '')[:100]
                sources = list(set(
                    v.get('metadata', {}).get('source', v.get('metadata', {}).get('source_doc', 'unknown'))
                    for v in cluster_vectors
                ))
                
                duplicate_cluster = DuplicateCluster(
                    cluster_id=f"CLUSTER-{len(clusters):03d}",
                    size=len(cluster),
                    avg_similarity=similarity_threshold,
                    representative_text=representative or f"Cluster {len(clusters)}",
                    sources=sources,
                    vector_ids=[v.get('vector_id', '') for v in cluster_vectors],
                    action="Merge similar chunks"
                )
                clusters.append(duplicate_cluster)
        
        return clusters
    
    def _generate_embedding(self, text: str, model: str) -> np.ndarray:
        """Generate embedding for text. Uses OpenAI when API key available, else hash-based simulation."""
        # Try OpenAI first when API key is available
        try:
            from openai import OpenAI
            from app.core.config import settings
            if settings.OPENAI_API_KEY:
                client = OpenAI(api_key=settings.OPENAI_API_KEY)
                # Map model names - OpenAI supports text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
                openai_model = model if model in self.supported_embedding_models else "text-embedding-3-small"
                resp = client.embeddings.create(model=openai_model, input=text[:8000])  # Truncate for token limit
                vec = resp.data[0].embedding
                return np.array(vec, dtype=np.float64)
        except Exception:
            pass  # Fall through to simulation

        # Fallback: hash-based embedding for simulation when no API key
        dim = 3072 if "large" in model else 1536 if "small" in model else 1536
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        seed = int(hash_obj.hexdigest()[:8], 16)
        np.random.seed(seed)
        embedding = np.random.normal(0, 0.1, dim)
        embedding = embedding / norm(embedding)  # Normalize
        return embedding


# Global instance
vector_embedding_evaluator = VectorEmbeddingEvaluator()
