"""
Embedding Security Analyzer
---------------------------
Generates embeddings (OpenAI or local model) and performs security analysis:
- Quality / statistics
- Outlier and anomaly scoring
- Collision detection
- Poisoning suspicion scoring

Designed to return dictionaries compatible with the embedding_analysis schema:
{
  "statistics": {...},
  "anomaly_scores": {...},
  "similarity_matches": [...],
  "risk_indicators": [...]
}
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy.linalg import norm
from scipy import stats

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.ensemble import IsolationForest
except Exception:  # pragma: no cover
    cosine_similarity = None
    IsolationForest = None

try:
    import openai  # type: ignore
    from openai import OpenAI  # type: ignore
except Exception:  # pragma: no cover
    openai = None
    OpenAI = None

try:
    from sentence_transformers import SentenceTransformer  # type: ignore
except Exception:  # pragma: no cover
    SentenceTransformer = None


# ---------------- Embedding Generator ---------------- #
class EmbeddingGenerator:
    def __init__(self, local_model: str = "all-MiniLM-L6-v2"):
        self.local_model_name = local_model
        self._local_model = None

    def generate_embedding(self, text: str, model: str = "text-embedding-3-small") -> np.ndarray:
        """
        Generate embeddings using OpenAI or a local sentence-transformers model.
        """
        # Try OpenAI first
        if OpenAI is not None:
            try:
                client = OpenAI()
                resp = client.embeddings.create(model=model, input=text)
                vec = resp.data[0].embedding
                return np.array(vec, dtype=np.float32)
            except Exception:
                # Fall through to local model
                pass

        # Local fallback
        if SentenceTransformer is not None:
            if self._local_model is None:
                self._local_model = SentenceTransformer(self.local_model_name)
            return self._local_model.encode(text, convert_to_numpy=True)

        raise RuntimeError("No embedding provider available (OpenAI or sentence-transformers required).")


# ---------------- Analysis Result Helpers ---------------- #
def _basic_stats(vec: np.ndarray) -> Dict[str, Any]:
    return {
        "dimension": int(vec.shape[-1]) if vec.ndim > 0 else 0,
        "norm": float(norm(vec)),
        "mean": float(np.mean(vec)),
        "std": float(np.std(vec)),
        "min": float(np.min(vec)),
        "max": float(np.max(vec)),
    }


def _z_score(value: float, mean: float, std_dev: float) -> float:
    if std_dev == 0:
        return 0.0
    return (value - mean) / std_dev


# ---------------- Embedding Security Analyzer ---------------- #
class EmbeddingSecurityAnalyzer:
    def __init__(self, collision_threshold: float = 0.95):
        self.collision_threshold = collision_threshold

    def analyze_embedding(self, embedding: np.ndarray, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a single embedding for quality and anomalies.
        Returns a dict compatible with embedding_analysis schema.
        """
        stats_dict = _basic_stats(embedding)

        # Quality checks
        quality_flags = []
        if stats_dict["norm"] < 5:
            quality_flags.append("very_low_norm")
        if stats_dict["std"] < 0.05:
            quality_flags.append("low_variance")
        if stats_dict["std"] > 1.5:
            quality_flags.append("high_variance")

        # Z-score on norm vs provided baseline (if any)
        baseline = context.get("baseline_stats", {})
        norm_z = 0.0
        if baseline:
            norm_z = _z_score(
                stats_dict["norm"],
                baseline.get("mean_norm", 0.0),
                baseline.get("std_norm", 1e-6),
            )

        anomaly_scores = {
            "norm_z_score": norm_z,
            "quality_flags": quality_flags,
        }

        # Risk indicators (simple heuristic)
        risk_indicators = []
        if abs(norm_z) >= 3:
            risk_indicators.append("outlier_norm")
        if "very_low_norm" in quality_flags or "low_variance" in quality_flags:
            risk_indicators.append("weak_embedding")
        if "high_variance" in quality_flags:
            risk_indicators.append("noisy_embedding")

        return {
            "statistics": stats_dict,
            "anomaly_scores": anomaly_scores,
            "similarity_matches": [],
            "risk_indicators": risk_indicators,
        }

    def detect_collisions(self, embeddings: List[np.ndarray]) -> List[Dict[str, Any]]:
        """
        Find high-similarity collisions (different inputs -> similar embeddings).
        Flags pairs with cosine similarity > threshold.
        """
        if not embeddings or len(embeddings) < 2:
            return []

        if cosine_similarity is None:
            return []

        mat = np.stack(embeddings)
        sim = cosine_similarity(mat)

        collisions: List[Dict[str, Any]] = []
        n = sim.shape[0]
        for i in range(n):
            for j in range(i + 1, n):
                score = sim[i, j]
                if score >= self.collision_threshold:
                    collisions.append(
                        {
                            "index_a": i,
                            "index_b": j,
                            "similarity": float(score),
                            "risk_indicator": "collision_high_similarity",
                        }
                    )
        # Sort by highest similarity
        collisions.sort(key=lambda x: x["similarity"], reverse=True)
        return collisions[:50]  # limit to top 50

    def detect_poisoning(
        self,
        embedding: np.ndarray,
        reference_embeddings: List[np.ndarray],
    ) -> Dict[str, Any]:
        """
        Detect if embedding might be poisoned/manipulated.
        Compares against reference distribution using distance and IsolationForest (if available).
        """
        if not reference_embeddings:
            return {"poison_risk": 0.0, "reason": "no_reference"}

        ref_mat = np.stack(reference_embeddings)
        ref_mean = np.mean(ref_mat, axis=0)
        ref_std = np.std(ref_mat, axis=0) + 1e-6

        # Mahalanobis-like distance (diagonal covariance)
        z = (embedding - ref_mean) / ref_std
        dist = math.sqrt(float(np.mean(z**2)))

        poison_risk = min(1.0, dist / 5.0)  # heuristic scaling
        reason = "distribution_shift" if dist > 3.0 else "within_expected"

        # Optional: Isolation Forest for anomaly score
        iso_score = None
        if IsolationForest is not None:
            try:
                clf = IsolationForest(contamination=0.05, random_state=42)
                clf.fit(ref_mat)
                pred_score = clf.decision_function([embedding])[0]
                # Lower scores mean more anomalous; normalize to risk 0-1
                iso_score = float(np.interp(pred_score, [-0.5, 0.5], [1.0, 0.0]))
                poison_risk = max(poison_risk, iso_score)
                reason = "isolation_forest_anomaly" if iso_score > 0.7 else reason
            except Exception:
                pass

        return {
            "poison_risk": float(poison_risk),
            "reason": reason,
            "isolation_forest_score": iso_score,
            "distance_score": float(dist),
        }





