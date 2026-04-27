# Realistic Vector Security Test Pack

This folder is a **real-life-style** dataset for testing **all 3 tabs** in Vector Security:

1) **Document Inspection**: scan documents before embedding  
2) **Anomaly Detection**: scan a vector store snapshot for poisoning / collisions / outliers / triggers  
3) **Attack Simulation**: simulate adversarial variants of queries and measure ranking manipulation (ASR + rank-shifts)

## What’s included

- `documents/`  
  Realistic `.txt` documents that contain:
  - normal enterprise text (HR, runbooks, contracts)
  - subtle prompt-injection / “developer mode” patterns
  - an obfuscation-like payload (`base64:`) for pattern scanning

- `queries_realistic.txt`  
  A mixed set of normal + adversarial queries (one per line).

- `vector_store_snapshot_small.json` + `ground_truth_small.json`  
  A **small** preset snapshot committed for quick UI testing.

Note: `medium` / `large` snapshots can be **hundreds of MB**. They are intentionally **not committed** (see repo root `.gitignore`)—generate them locally when you need stress tests.

## How to generate realistic vector snapshots (recommended)

From the repo root:

```bash
python samples/generate_realistic_vector_security_pack.py --preset medium
```

This will create:

- `vector_store_snapshot_<preset>.json` (upload to **Anomaly Detection**)
- `ground_truth_<preset>.json` (used by the benchmark script for precision/FP metrics)
- `queries_realistic.txt` (paste into **Attack Simulation**)

Presets:

- `small`: fast UI demo
- `medium`: realistic “team-sized” KB / RAG store
- `large`: stress test (perf + scalability signals)

## UI test flow (all three tabs)

### Document Inspection

- Open **Vector Security → Document Inspection**
- Upload any file from `samples/realistic_vector_security/documents/`
- Run with chunk size \(300–800\) and overlap \(40–120\)
- Expect: at least 1–3 flagged chunks (instruction / trigger / obfuscation patterns)

### Anomaly Detection

- Open **Vector Security → Anomaly Detection**
- Upload `vector_store_snapshot_<preset>.json`
- Use defaults, or set:
  - **Sample size**: 500–2000 (for responsiveness)
  - **Similarity threshold**: 0.95 (collision detection)
- Expect findings across:
  - `dense_cluster_poisoning`
  - `high_similarity_collision`
  - `extreme_norm_outlier`
  - `instruction_payload_detected` / `trigger_phrase_detected` / `obfuscated_token_detected`

### Attack Simulation

- Open **Vector Security → Attack Simulation**
- Upload the same `vector_store_snapshot_<preset>.json`
- Paste queries from `queries_realistic.txt`
- Enable variants: paraphrase + unicode + homoglyph + trigger
- Expect: a measurable **ASR** and multiple **rank-shift** findings

## Measuring “real-life efficiency”

For real users, “efficient” means:

- low latency (p50/p95)
- stable + reproducible results
- good detection quality (high true positive rate, low false positives)

Use the benchmark script:

```bash
python backend/scripts/bench_vector_security_realistic.py --preset small --repeat 5
```

For heavier runs, generate `medium` locally first, then:

```bash
python backend/scripts/bench_vector_security_realistic.py --preset medium --repeat 5
```

It reports:
- timing per endpoint
- counts by finding category
- precision/recall-style signals for store anomaly detection (using ground truth)

