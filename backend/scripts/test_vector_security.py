import json
from pathlib import Path

import httpx


def main() -> None:
    base_url = "http://localhost:8000/api/v1"
    root_dir = Path(__file__).resolve().parents[2]
    samples_dir = root_dir / "samples"
    inspection_file = samples_dir / "embedding_inspection_sample.txt"
    vector_file = samples_dir / "vector_snapshot_sample.json"

    if not inspection_file.exists():
        raise SystemExit(f"Missing sample file: {inspection_file}")
    if not vector_file.exists():
        raise SystemExit(f"Missing sample file: {vector_file}")

    with httpx.Client(timeout=120.0) as client:
        # Embedding inspection
        with inspection_file.open("rb") as fh:
            files = {"file": (inspection_file.name, fh, "text/plain")}
            data = {"chunk_size": "200", "chunk_overlap": "40"}
            resp = client.post(f"{base_url}/prompt-injection/embedding-inspection", files=files, data=data)
        print("Embedding Inspection:", resp.status_code)
        if resp.status_code != 200:
            print(resp.text)
        else:
            payload = resp.json()
            print(
                json.dumps(
                    {
                        "scan_id": payload.get("scan_id"),
                        "total_chunks": payload.get("total_chunks"),
                        "findings": len(payload.get("findings", [])),
                        "recommendations": payload.get("recommendations", [])[:3],
                    },
                    indent=2,
                )
            )

        # Vector store analysis
        with vector_file.open("rb") as fh:
            files = {"file": (vector_file.name, fh, "application/json")}
            data = {
                "batch_size": "500",
                "enable_clustering": "true",
                "enable_collision_detection": "true",
                "enable_outlier_detection": "true",
                "enable_trigger_detection": "true",
                "collision_threshold": "0.95",
            }
            resp = client.post(f"{base_url}/prompt-injection/vector-store-analysis", files=files, data=data)
        print("Vector Store Analysis:", resp.status_code)
        if resp.status_code != 200:
            print(resp.text)
        else:
            payload = resp.json()
            print(
                json.dumps(
                    {
                        "scan_id": payload.get("scan_id"),
                        "total_vectors": payload.get("total_vectors"),
                        "vectors_analyzed": payload.get("vectors_analyzed"),
                        "findings": len(payload.get("findings", [])),
                        "recommendations": payload.get("recommendations", [])[:3],
                    },
                    indent=2,
                )
            )


if __name__ == "__main__":
    main()
