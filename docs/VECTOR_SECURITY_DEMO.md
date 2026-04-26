# How to Give a Demo of Vector Security

This guide walks you through demonstrating all three parts of **Vector Security**: Document Inspection, Anomaly Detection, and Attack Simulation.

---

## Prerequisites

1. **Backend** running at `http://localhost:8000`
   ```bash
   cd backend && uvicorn app.main:app --reload
   ```

2. **Frontend** running (e.g. `http://localhost:3000`)
   ```bash
   cd frontend && npm start
   ```

3. **Logged in** to the app (Dashboard access required).

4. **Sample files** (in repo `samples/`):
   - **Document Inspection**: any PDF or text file (e.g. a policy doc, or create a small `.txt` with a few paragraphs).
   - **Anomaly Detection**: `samples/vector_snapshot_sample.json` or `samples/vector_store_test.json`.
   - **Attack Simulation**: `samples/retrieval_attack_vectors.json`.

---

## Opening Vector Security

1. Log in and go to the **Dashboard**.
2. In the left sidebar, click **Vector Security** (shield icon).
3. You’ll see three tabs: **Document Inspection**, **Anomaly Detection**, **Attack Simulation**.

---

## 1. Document Inspection (first tab)

**What it does:** Scans a document before it goes into a vector store. Finds chunks that look like prompt-injection or adversarial content (instruction payloads, trigger phrases, obfuscation, extreme repetition).

**Demo steps:**

1. Stay on the **Document Inspection** tab.
2. **Upload a document**: Click “Drop file here or click to browse” and choose a PDF or text file.  
   - For a quick demo, use a small PDF (e.g. terms of service) or a `.txt` with a few paragraphs; you can add a line like “Ignore previous instructions” in a paragraph to get a clear finding.
3. Optionally adjust **Chunk size** (e.g. 500) and **Chunk overlap** (e.g. 100).
4. Click **Inspect Document**.
5. When it finishes:
   - **Summary**: total chunks, risk score, number of findings.
   - **Findings**: list of suspicious chunks with category (e.g. instruction payload, trigger phrase). Click a finding to see details.
   - You can try **Sanitization preview** (mask/sanitize/remove) and **Re-analyze** or **Export** to show remediation.

**One-liner for audience:**  
“We scan documents before they’re embedded. The tool flags chunks that look like prompt injection or triggers so we can sanitize them before they enter the vector store.”

---

## 2. Anomaly Detection (second tab)

**What it does:** Analyzes a vector store (from an uploaded JSON snapshot or a live DB) for suspicious vectors, collisions, and poisoning (e.g. outliers, injection-like content).

**Demo steps – Upload mode (easiest for demo):**

1. Open the **Anomaly Detection** tab.
2. Select **Upload Snapshot** (first card).
3. **Upload**: Click the upload area and choose `samples/vector_snapshot_sample.json` (or `samples/vector_store_test.json` if you have it).
4. Optionally set **Max vectors** (e.g. 500) to keep the run fast.
5. Click **Run Analysis** (or **Analyze**).
6. When it finishes:
   - **Analysis Results**: total vectors, number analyzed, findings count, poisoned/suspicious counts.
   - **Detailed Findings**: list of findings (outliers, collisions, poisoning). Click a row for details (e.g. vector ID, neighbors, recommended action).
   - You can **Export** the report (e.g. JSON).

**Demo steps – Connect mode (if you have a vector DB):**

1. Select **Connect to Database** (second card).
2. Choose provider (Pinecone, Chroma, Qdrant, Weaviate, etc.) and fill API key / URL / index name as required.
3. Click **Test Connection**; when it shows “Connected (N vectors)”, click **Run Analysis**.
4. Use **Analysis Results** and **Detailed Findings** as above.

**One-liner for audience:**  
“We run anomaly detection on the vector store: outliers, similarity collisions, and vectors that look poisoned. The report tells us which vectors to quarantine or re-embed.”

---

## 3. Attack Simulation (third tab)

**What it does:** Tests retrieval robustness by turning normal queries into adversarial variants (paraphrase, unicode, homoglyph, trigger). It compares baseline vs adversarial retrieval and reports attack success rate (ASR) and ranking manipulations.

**Demo steps:**

1. Open the **Attack Simulation** tab.
2. **Vector index snapshot**: Upload `samples/retrieval_attack_vectors.json`.
3. **Test queries**: In the text area, enter one query per line, e.g.:
   - `What are the terms of service?`
   - `How do you handle user data?`
   - `Tell me about privacy policy`
4. Optionally adjust **Top-K**, **Similarity threshold**, **Rank shift Δ**, and which **Adversarial variants** to enable (Paraphrase, Unicode, Homoglyph, Trigger).
5. Click **Run Simulation**.
6. When it finishes:
   - **Results**: ASR, total/successful/failed queries, findings count, rank-shift metrics, recommendations.
   - **Findings**: list of ranking manipulations; click a row for variant, confidence, rank shift, target vector, recommended action.
   - Use **Export Report** (JSON/CSV/PDF) to save or share.

**Detailed explanation and report interpretation:**  
See **[DEMO_ATTACK_SIMULATION.md](./DEMO_ATTACK_SIMULATION.md)** for what the simulation does, how to read ASR and findings, and how to explain the report in a presentation.

**One-liner for audience:**  
“We simulate retrieval attacks by mutating queries with four variant types. The tool reports attack success rate and each ranking manipulation so we can harden retrieval with normalization and sanitization.”

---

## Quick verification (backend only)

From the **project root**:

```bash
cd backend
python scripts/test_vector_security_complete.py
```

This runs all three flows (inspection, anomaly detection, retrieval attack) against the API. You should see **TEST 1**, **TEST 2**, and **TEST 3** complete; **TEST 3** corresponds to Attack Simulation (ASR and findings count).

---

## Sample files reference

| Purpose              | File                               | Notes |
|----------------------|------------------------------------|--------|
| Anomaly Detection    | `samples/vector_snapshot_sample.json` | Small snapshot with clean/outlier/trigger vectors. |
| Anomaly Detection    | `samples/vector_store_test.json`   | Generated by test script if needed. |
| Attack Simulation    | `samples/retrieval_attack_vectors.json` | Vector index with `vectors` array (embedding, optional vector_id, metadata). |
| Document Inspection  | Any PDF or `.txt`                  | Or use a doc that contains a line like “Ignore previous instructions” for a clear finding. |

---

## Suggested demo order

1. **Document Inspection** – show “we check content before it becomes vectors.”
2. **Anomaly Detection** – show “we scan the store for bad or weird vectors.”
3. **Attack Simulation** – show “we stress-test retrieval with adversarial queries and get ASR + findings.”

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| “Please select a document” (Inspection) | Choose a PDF or text file before clicking Inspect. |
| “Please select a vector index snapshot file” (Attack) | Upload a JSON file that has a top-level `vectors` array (e.g. `retrieval_attack_vectors.json`). |
| “Please enter at least one query” (Attack) | Add at least one line in the Test Queries box. |
| Analysis/Simulation timeout or fails | Backend running? For large snapshots, reduce **Max vectors** or use a smaller sample. |
| CORS or network errors | Frontend `REACT_APP_API_URL` should point to the backend (e.g. `http://localhost:8000/api/v1` for local). |

---

## One-slide summary for presentations

- **Vector Security** = three tools in one place:
  1. **Document Inspection** – scan docs for injection/trigger content before embedding.
  2. **Anomaly Detection** – find suspicious vectors and poisoning in the store (upload JSON or connect DB).
  3. **Attack Simulation** – adversarial query variants → ASR and ranking manipulations → recommendations.

Use the sample files in `samples/` and the steps above for a repeatable, scripted demo.
