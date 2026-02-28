"""
Vector Store Anomaly Detection
------------------------------
Analyzes vector store snapshots for:
- Dense clusters spanning unrelated sources/tenants (poisoning)
- High-similarity collisions across different labels/topics
- Extreme-norm/outlier vectors
- Vectors tied to known trigger patterns
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
import numpy as np
from numpy.linalg import norm

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.ensemble import IsolationForest
    from sklearn.cluster import DBSCAN
except Exception:
    cosine_similarity = None
    IsolationForest = None
    DBSCAN = None


def _basic_stats(vec: np.ndarray) -> Dict[str, Any]:
    """Calculate basic statistics for a vector."""
    return {
        "dimension": int(vec.shape[-1]) if vec.ndim > 0 else 0,
        "norm": float(norm(vec)),
        "mean": float(np.mean(vec)),
        "std": float(np.std(vec)),
        "min": float(np.min(vec)),
        "max": float(np.max(vec)),
        "variance": float(np.var(vec)),
    }


def _z_score(value: float, mean: float, std_dev: float) -> float:
    """Calculate Z-score."""
    if std_dev == 0:
        return 0.0
    return (value - mean) / std_dev


class VectorStoreAnomalyDetector:
    """
    Analyzes vector store snapshots for anomalies and security threats.
    Implements all requirements from the Vector Store Anomaly Detection user story.
    """
    
    def __init__(
        self,
        collision_threshold: float = 0.95,
        outlier_z_threshold: float = 3.0,
        cluster_eps: float = 0.3,
        min_samples: int = 3
    ):
        self.collision_threshold = collision_threshold
        self.outlier_z_threshold = outlier_z_threshold
        self.cluster_eps = cluster_eps
        self.min_samples = min_samples
        
        # Advanced adversarial patterns (synced with EmbeddingInspector)
        self.instruction_patterns = [
            r"(?i)(ignore|disregard|forget|override|bypass).*(previous|prior|above|earlier|all).*(instruction|prompt|rule|directive)",
            r"(?i)(act as|pretend to be|roleplay as|you are now).*(unrestricted|unfiltered|uncensored|evil|harmful)",
            r"(?i)(system.*override|emergency.*protocol|admin.*access|developer.*mode|skeleton.*key)",
            r"(?i)(disable|remove|turn off).*(safety|security|filter|restriction|guardrail|alignment)",
            r"(?i)crescendo.*escalation|adversarial.*in-context.*learning",
        ]
        
        self.trigger_phrases = [
            r"(?i)\bDAN\b|do anything now",
            r"(?i)jailbreak|jailbroken",
            r"(?i)reveal (system|internal|hidden|secret|confidential)",
            r"(?i)break free|escape.*confines",
            r"(?i)### system prompt ###|\[system_instruction\]",
            r"(?i)output everything inside \[\[\]\]|repeat.*beginning.*word.*for.*word",
        ]
        
        self.obfuscation_patterns = [
            r"base64[:\s]*[A-Za-z0-9+/=]{20,}",
            r"0x[0-9a-fA-F]{16,}",
            r"\\u[0-9a-fA-F]{4}(\\u[0-9a-fA-F]{4})+",
            r"&#x[0-9a-fA-F]{2,4};",
            r"[A-Za-z0-9+/=]{30,}",
            r"(?i)1gn0r3|pr0mp7|5y573m",
        ]
    
    def compute_distribution_stats(
        self, 
        embeddings: List[np.ndarray],
        metadata_list: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Compute distribution and neighborhood stats without modifying the store.
        Returns: norms, density, collision rates, etc.
        """
        if not embeddings:
            return {}
        
        embeddings_array = np.stack(embeddings)
        n = len(embeddings)
        
        # Basic statistics
        norms = [norm(emb) for emb in embeddings]
        mean_norm = float(np.mean(norms))
        std_norm = float(np.std(norms))
        min_norm = float(np.min(norms))
        max_norm = float(np.max(norms))
        
        # Density metrics
        if cosine_similarity is not None and n > 1:
            sim_matrix = cosine_similarity(embeddings_array)
            # Average similarity (excluding diagonal)
            avg_similarity = float(np.mean(sim_matrix[np.triu_indices(n, k=1)]))
            # Density: percentage of pairs above threshold
            high_sim_pairs = np.sum(sim_matrix >= self.collision_threshold) - n  # exclude diagonal
            collision_rate = float(high_sim_pairs / (n * (n - 1) / 2)) if n > 1 else 0.0
        else:
            avg_similarity = 0.0
            collision_rate = 0.0
        
        # Dimension consistency
        dimensions = [emb.shape[0] for emb in embeddings]
        unique_dims = len(set(dimensions))
        dimension_consistency = unique_dims == 1
        
        # Per-vector statistics
        vector_stats = []
        for i, emb in enumerate(embeddings):
            stats = _basic_stats(emb)
            stats["vector_id"] = i
            if metadata_list and i < len(metadata_list):
                stats["metadata"] = metadata_list[i]
            vector_stats.append(stats)
        
        return {
            "total_vectors": n,
            "mean_norm": mean_norm,
            "std_norm": std_norm,
            "min_norm": min_norm,
            "max_norm": max_norm,
            "avg_similarity": avg_similarity,
            "collision_rate": collision_rate,
            "dimension": dimensions[0] if dimensions else 0,
            "dimension_consistency": dimension_consistency,
            "vector_stats": vector_stats[:100],  # Limit for response size
        }
    
    def detect_dense_clusters(
        self,
        embeddings: List[np.ndarray],
        metadata_list: Optional[List[Dict[str, Any]]] = None,
        tenant_field: Optional[str] = "tenant_id"
    ) -> List[Dict[str, Any]]:
        """
        Detect dense clusters spanning unrelated sources/tenants (possible poisoning).
        Uses DBSCAN clustering and checks for cross-tenant/source clusters.
        """
        if not embeddings or len(embeddings) < self.min_samples:
            return []
        
        if DBSCAN is None:
            return []
        
        findings = []
        embeddings_array = np.stack(embeddings)
        
        try:
            # Cluster embeddings
            clustering = DBSCAN(eps=self.cluster_eps, min_samples=self.min_samples, metric='cosine')
            cluster_labels = clustering.fit_predict(embeddings_array)
            
            # Analyze clusters
            cluster_info = defaultdict(lambda: {"indices": [], "tenants": set(), "sources": set()})
            
            for idx, label in enumerate(cluster_labels):
                if label != -1:  # -1 is noise in DBSCAN
                    cluster_info[label]["indices"].append(idx)
                    if metadata_list and idx < len(metadata_list):
                        meta = metadata_list[idx]
                        if tenant_field and tenant_field in meta:
                            cluster_info[label]["tenants"].add(meta[tenant_field])
                        if "source_doc" in meta or "source" in meta:
                            source = meta.get("source_doc") or meta.get("source", "unknown")
                            cluster_info[label]["sources"].add(str(source))
            
            # Flag clusters with multiple tenants/sources (potential poisoning)
            for cluster_id, info in cluster_info.items():
                if len(info["indices"]) >= self.min_samples:
                    # Check for cross-tenant/source clustering
                    if len(info["tenants"]) > 1 or len(info["sources"]) > 1:
                        # Calculate cluster center and average similarity
                        cluster_embeddings = embeddings_array[info["indices"]]
                        cluster_center = np.mean(cluster_embeddings, axis=0)
                        
                        if cosine_similarity is not None:
                            sims = cosine_similarity(cluster_embeddings, [cluster_center])
                            avg_sim = float(np.mean(sims))
                        else:
                            avg_sim = 0.0
                        
                        findings.append({
                            "category": "dense_cluster_poisoning",
                            "cluster_id": int(cluster_id),
                            "vector_count": len(info["indices"]),
                            "vector_ids": info["indices"][:20],  # Limit for response
                            "tenants": list(info["tenants"]) if info["tenants"] else [],
                            "sources": list(info["sources"]) if info["sources"] else [],
                            "avg_similarity": avg_sim,
                            "confidence": min(1.0, avg_sim * 1.1) if avg_sim > 0.8 else 0.6,
                            "description": f"Dense cluster with {len(info['indices'])} vectors spanning {len(info['tenants'])} tenants and {len(info['sources'])} sources",
                            "recommended_action": "Quarantine cluster vectors; investigate for poisoning; re-embed with new model"
                        })
        
        except Exception as e:
            # If clustering fails, return empty list
            pass
        
        return findings
    
    def detect_collisions(
        self,
        embeddings: List[np.ndarray],
        metadata_list: Optional[List[Dict[str, Any]]] = None,
        label_field: Optional[str] = "label",
        topic_field: Optional[str] = "topic"
    ) -> List[Dict[str, Any]]:
        """
        Detect high-similarity collisions across different labels/topics.
        """
        if not embeddings or len(embeddings) < 2:
            return []
        
        if cosine_similarity is None:
            return []
        
        findings = []
        embeddings_array = np.stack(embeddings)
        sim_matrix = cosine_similarity(embeddings_array)
        
        n = len(embeddings)
        checked_pairs = set()
        
        for i in range(n):
            for j in range(i + 1, n):
                if (i, j) in checked_pairs:
                    continue
                
                similarity = sim_matrix[i, j]
                
                if similarity >= self.collision_threshold:
                    # Check if they have different labels/topics
                    label_diff = False
                    topic_diff = False
                    
                    if metadata_list:
                        meta_i = metadata_list[i] if i < len(metadata_list) else {}
                        meta_j = metadata_list[j] if j < len(metadata_list) else {}
                        
                        if label_field:
                            label_i = meta_i.get(label_field)
                            label_j = meta_j.get(label_field)
                            if label_i and label_j and label_i != label_j:
                                label_diff = True
                        
                        if topic_field:
                            topic_i = meta_i.get(topic_field)
                            topic_j = meta_j.get(topic_field)
                            if topic_i and topic_j and topic_i != topic_j:
                                topic_diff = True
                    
                    if label_diff or topic_diff:
                        findings.append({
                            "category": "high_similarity_collision",
                            "vector_id_a": i,
                            "vector_id_b": j,
                            "similarity": float(similarity),
                            "label_different": label_diff,
                            "topic_different": topic_diff,
                            "metadata_a": metadata_list[i] if metadata_list and i < len(metadata_list) else {},
                            "metadata_b": metadata_list[j] if metadata_list and j < len(metadata_list) else {},
                            "confidence": float(similarity),
                            "description": f"High similarity ({similarity:.3f}) between vectors with different {'labels' if label_diff else 'topics'}",
                            "recommended_action": "Review collision; consider re-embedding with different model or adjust similarity threshold"
                        })
                    
                    checked_pairs.add((i, j))
        
        # Sort by similarity
        findings.sort(key=lambda x: x["similarity"], reverse=True)
        return findings[:100]  # Limit results
    
    def detect_outliers(
        self,
        embeddings: List[np.ndarray],
        metadata_list: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Detect extreme-norm/outlier vectors using Z-score and Isolation Forest.
        """
        if not embeddings:
            return []
        
        findings = []
        embeddings_array = np.stack(embeddings)
        norms = [norm(emb) for emb in embeddings]
        mean_norm = np.mean(norms)
        std_norm = np.std(norms) + 1e-6
        
        # Z-score based outlier detection
        for i, (emb, norm_val) in enumerate(zip(embeddings, norms)):
            z_score = abs(_z_score(norm_val, mean_norm, std_norm))
            
            if z_score >= self.outlier_z_threshold:
                stats = _basic_stats(emb)
                findings.append({
                    "category": "extreme_norm_outlier",
                    "vector_id": i,
                    "norm": float(norm_val),
                    "z_score": float(z_score),
                    "mean_norm": float(mean_norm),
                    "std_norm": float(std_norm),
                    "statistics": stats,
                    "metadata": metadata_list[i] if metadata_list and i < len(metadata_list) else {},
                    "confidence": min(1.0, z_score / 5.0),
                    "description": f"Extreme norm outlier (Z-score: {z_score:.2f}, norm: {norm_val:.3f})",
                    "recommended_action": "Review vector; may indicate corrupted embedding or adversarial input"
                })
        
        # Isolation Forest for additional anomaly detection
        if IsolationForest is not None and len(embeddings) > 10:
            try:
                clf = IsolationForest(contamination=0.05, random_state=42)
                clf.fit(embeddings_array)
                anomaly_scores = clf.decision_function(embeddings_array)
                
                # Lower scores = more anomalous
                threshold = np.percentile(anomaly_scores, 5)  # Bottom 5%
                
                for i, score in enumerate(anomaly_scores):
                    if score <= threshold and i not in [f["vector_id"] for f in findings]:
                        stats = _basic_stats(embeddings[i])
                        findings.append({
                            "category": "isolation_forest_outlier",
                            "vector_id": i,
                            "anomaly_score": float(score),
                            "statistics": stats,
                            "metadata": metadata_list[i] if metadata_list and i < len(metadata_list) else {},
                            "confidence": float(np.interp(score, [-0.5, 0.5], [1.0, 0.0])),
                            "description": f"Isolation Forest detected anomaly (score: {score:.3f})",
                            "recommended_action": "Investigate vector; may be poisoned or corrupted"
                        })
            except Exception:
                pass
        
        return findings
    
    def detect_trigger_patterns(
        self,
        embeddings: List[np.ndarray],
        metadata_list: Optional[List[Dict[str, Any]]] = None,
        text_field: Optional[str] = "text"
    ) -> List[Dict[str, Any]]:
        """
        Detect vectors tied to known trigger patterns (where metadata/text available).
        """
        if not metadata_list:
            return []
        
        findings = []
        import re
        
        for i, meta in enumerate(metadata_list):
            text = meta.get(text_field) or meta.get("content") or meta.get("chunk_text", "")
            
            if not text:
                continue
            
            # 1. Check for instruction-like payloads
            for pattern in self.instruction_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    findings.append({
                        "category": "instruction_payload_detected",
                        "vector_id": i,
                        "pattern_matched": pattern,
                        "snippet": text[max(0, match.start() - 50):min(len(text), match.end() + 50)],
                        "metadata": meta,
                        "confidence": 0.90,
                        "description": f"Instruction-like payload detected in vector metadata: {pattern[:50]}...",
                        "recommended_action": "Quarantine vector; sanitize or remove if adversarial"
                    })
                    break
            
            # 2. Check for trigger phrases
            for pattern in self.trigger_phrases:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    findings.append({
                        "category": "trigger_phrase_detected",
                        "vector_id": i,
                        "pattern_matched": pattern,
                        "snippet": text[max(0, match.start() - 50):min(len(text), match.end() + 50)],
                        "metadata": meta,
                        "confidence": 0.85,
                        "description": f"Jailbreak trigger phrase detected in vector metadata: {pattern[:50]}...",
                        "recommended_action": "Remove vector from store; investigate source document"
                    })
                    break
            
            # 3. Check for obfuscated tokens
            for pattern in self.obfuscation_patterns:
                matches = re.finditer(pattern, text)
                for match in matches:
                    findings.append({
                        "category": "obfuscated_token_detected",
                        "vector_id": i,
                        "pattern_matched": pattern,
                        "snippet": text[max(0, match.start() - 50):min(len(text), match.end() + 50)],
                        "metadata": meta,
                        "confidence": 0.70,
                        "description": f"Obfuscated content (Base64/Hex/Leetspeak) detected in vector metadata",
                        "recommended_action": "Decode and inspect content for hidden commands"
                    })
                    break
        
        return findings
    
    def find_nearest_neighbors(
        self,
        embedding: np.ndarray,
        all_embeddings: List[np.ndarray],
        k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find k nearest neighbors for a given embedding.
        """
        if not all_embeddings or cosine_similarity is None:
            return []
        
        all_array = np.stack(all_embeddings)
        similarities = cosine_similarity([embedding], all_array)[0]
        
        # Get top k (excluding self if embedding is in all_embeddings)
        top_indices = np.argsort(similarities)[::-1][:k+1]
        
        neighbors = []
        for idx in top_indices:
            if idx < len(all_embeddings):
                neighbors.append({
                    "vector_id": int(idx),
                    "similarity": float(similarities[idx])
                })
        
        return neighbors[:k]

