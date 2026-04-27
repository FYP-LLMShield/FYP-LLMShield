"""
Vector Security realistic benchmark.

Measures "real-life efficiency" signals:
- Latency per module (p50/p95 across repeats)
- Finding volume (noise) and category distribution
- Simple precision/recall-style signals for Anomaly Detection using generated ground truth

Prereqs:
- Backend running locally (default http://localhost:8000)
- Generate data:
    python samples/generate_realistic_vector_security_pack.py --preset medium
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

import httpx


ROOT = Path(__file__).resolve().parents[2]
SAMPLES = ROOT / "samples" / "realistic_vector_security"


def _p50(values: List[float]) -> float:
    return statistics.median(values) if values else 0.0


def _p95(values: List[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = int(round(0.95 * (len(s) - 1)))
    return s[max(0, min(idx, len(s) - 1))]


def _load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _anomaly_quality(report: Dict[str, Any], ground_truth: Dict[str, Any]) -> Dict[str, Any]:
    """
    Very lightweight evaluation:
    - Treat any record_id present in findings (record_id / record_ids) as "flagged"
    - Ground truth provides record_labels[record_id].malicious boolean
    """
    labels = ground_truth.get("record_labels", {})
    malicious_ids = {rid for rid, info in labels.items() if info.get("malicious") is True}

    flagged: set[str] = set()
    for f in report.get("findings", []) or []:
        rid = f.get("record_id")
        if rid:
            flagged.add(str(rid))
        for rids in (f.get("record_ids") or []):
            flagged.add(str(rids))

    tp = len(flagged & malicious_ids)
    fp = len(flagged - malicious_ids)
    fn = len(malicious_ids - flagged)
    precision = tp / (tp + fp) if (tp + fp) else 1.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0

    return {
        "malicious_total": len(malicious_ids),
        "flagged_total": len(flagged),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8000/api/v1")
    ap.add_argument("--preset", choices=["small", "medium", "large"], default="medium")
    ap.add_argument("--repeat", type=int, default=5)
    args = ap.parse_args()

    vector_path = SAMPLES / f"vector_store_snapshot_{args.preset}.json"
    gt_path = SAMPLES / f"ground_truth_{args.preset}.json"
    docs = sorted((SAMPLES / "documents").glob("*.txt"))
    queries_path = SAMPLES / "queries_realistic.txt"

    if not vector_path.exists():
        raise SystemExit(f"Missing snapshot. Generate it first: {vector_path}")
    if not gt_path.exists():
        raise SystemExit(f"Missing ground truth. Generate it first: {gt_path}")
    if not docs:
        raise SystemExit("Missing documents. Re-run the generator.")

    ground_truth = _load_json(gt_path)
    queries = queries_path.read_text(encoding="utf-8")

    results: Dict[str, Any] = {
        "preset": args.preset,
        "repeat": args.repeat,
        "base_url": args.base_url,
        "timings_ms": {},
        "anomaly_quality": {},
        "category_counts": {},
    }

    t_embed: List[float] = []
    t_store: List[float] = []
    t_retrieval: List[float] = []

    with httpx.Client(timeout=180.0) as client:
        # 1) Document Inspection (pick 1 realistic doc)
        doc_path = docs[0]
        for _ in range(args.repeat):
            t0 = time.perf_counter()
            with doc_path.open("rb") as fh:
                files = {"file": (doc_path.name, fh, "text/plain")}
                data = {"chunk_size": "600", "chunk_overlap": "80"}
                r = client.post(f"{args.base_url}/prompt-injection/embedding-inspection", files=files, data=data)
            dt = (time.perf_counter() - t0) * 1000
            if r.status_code != 200:
                raise SystemExit(f"Embedding inspection failed: {r.status_code} {r.text[:250]}")
            t_embed.append(dt)

        # 2) Vector Store Anomaly Detection
        store_payload = None
        for _ in range(args.repeat):
            t0 = time.perf_counter()
            with vector_path.open("rb") as fh:
                files = {"file": (vector_path.name, fh, "application/json")}
                data = {
                    "batch_size": "1000",
                    "enable_clustering": "true",
                    "enable_collision_detection": "true",
                    "enable_outlier_detection": "true",
                    "enable_trigger_detection": "true",
                    "collision_threshold": "0.95",
                }
                r = client.post(f"{args.base_url}/prompt-injection/vector-store-analysis", files=files, data=data)
            dt = (time.perf_counter() - t0) * 1000
            if r.status_code != 200:
                raise SystemExit(f"Vector store analysis failed: {r.status_code} {r.text[:250]}")
            store_payload = r.json()
            t_store.append(dt)

        # 3) Retrieval Attack Simulation
        retrieval_payload = None
        for _ in range(args.repeat):
            t0 = time.perf_counter()
            with vector_path.open("rb") as fh:
                files = {"file": (vector_path.name, fh, "application/json")}
                data = {
                    "queries": queries,
                    "top_k": "10",
                    "similarity_threshold": "0.7",
                    "rank_shift_threshold": "5",
                    "variants": "paraphrase,unicode,homoglyph,trigger",
                    "enable_model_inference": "false",
                }
                r = client.post(f"{args.base_url}/prompt-injection/retrieval-attack-simulation", files=files, data=data)
            dt = (time.perf_counter() - t0) * 1000
            if r.status_code != 200:
                raise SystemExit(f"Retrieval attack simulation failed: {r.status_code} {r.text[:250]}")
            retrieval_payload = r.json()
            t_retrieval.append(dt)

    # Summaries
    results["timings_ms"] = {
        "embedding_inspection": {"p50": _p50(t_embed), "p95": _p95(t_embed), "runs": len(t_embed)},
        "vector_store_analysis": {"p50": _p50(t_store), "p95": _p95(t_store), "runs": len(t_store)},
        "retrieval_attack_simulation": {"p50": _p50(t_retrieval), "p95": _p95(t_retrieval), "runs": len(t_retrieval)},
    }

    if store_payload:
        results["anomaly_quality"] = _anomaly_quality(store_payload, ground_truth)
        cat_counts: Dict[str, int] = {}
        for f in store_payload.get("findings", []) or []:
            c = f.get("category", "unknown")
            cat_counts[c] = cat_counts.get(c, 0) + 1
        results["category_counts"]["vector_store_analysis"] = cat_counts

    if retrieval_payload:
        sm = retrieval_payload.get("summary_metrics") or {}
        results["category_counts"]["retrieval_attack_simulation"] = {
            "findings": len(retrieval_payload.get("findings", []) or []),
            "asr_legacy_any_rank_delta": retrieval_payload.get("attack_success_rate", 0.0),
            "asr_headline_top3_changed": sm.get("headline_variant_asr_top3_changed", 0.0),
            "material_findings": sm.get("material_findings_count", 0),
            "material_query_asr": sm.get("material_query_asr", 0.0),
            "queries": retrieval_payload.get("total_queries", 0),
        }

    out_path = SAMPLES / f"bench_report_{args.preset}.json"
    out_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"[OK] Wrote benchmark report: {out_path}")
    print(json.dumps(results["timings_ms"], indent=2))
    if results.get("anomaly_quality"):
        print(json.dumps(results["anomaly_quality"], indent=2))


if __name__ == "__main__":
    main()

