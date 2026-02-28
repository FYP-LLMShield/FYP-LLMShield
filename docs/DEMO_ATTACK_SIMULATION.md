# Vector Security – Attack Simulation Demo

This guide helps you run a smooth demo of the **Attack Simulation** feature under **Vector Security**.

## Prerequisites

1. **Backend** running at `http://localhost:8000` (or your deployed API).
2. **Frontend** running (e.g. `npm start` in `frontend/`).
3. **Sample data** in the repo:
   - `samples/retrieval_attack_vectors.json` – vector index snapshot (JSON with `vectors` array).
   - `samples/retrieval_attack_queries.json` – optional; you can also type queries in the UI.

## Quick verification (backend only)

From the project root:

```bash
cd backend
python scripts/test_vector_security_complete.py
```

You should see **TEST 3: Retrieval Attack Simulation** pass with:
- Total queries tested
- Attack success rate (ASR)
- Number of ranking manipulations and breakdown by variant (paraphrase, unicode, homoglyph, trigger)

## Demo steps (UI)

1. **Open the app** and go to **Dashboard**.
2. In the sidebar, click **Vector Security**.
3. Open the **Attack Simulation** tab (orange target icon).
4. **Configuration**
   - **Vector Index Snapshot**: Upload `samples/retrieval_attack_vectors.json`.
   - **Test Queries**: Paste one query per line, e.g.:
     - `What are the terms of service?`
     - `How do you handle user data?`
     - `Tell me about privacy policy`
   - Optionally adjust **Top-K**, **Similarity Threshold**, **Rank Shift Δ**, and **Adversarial Variants** (Paraphrase, Unicode, Homoglyph, Trigger-Augmented).
5. Click **Run Simulation**.
6. After the run:
   - **Results** tab: ASR, total/successful/failed queries, findings count, rank-shift metrics, recommendations, and export (JSON/CSV/PDF).
   - **Findings** tab: list of ranking manipulations; click a row to open details (variant, confidence, rank shift, target vector, recommended action).

## Understanding the Report (What Happened)

Use this when you need to explain the results to yourself or others (e.g. in a demo or FYP presentation).

### What the simulation did

1. **Your input**: You gave the system a **vector index** (a snapshot of how your documents are stored for search) and **one or more test queries** (e.g. “What are the terms of service?”).
2. **What the tool did**: For each query, it created **adversarial variants**—slightly altered versions of the same question that an attacker might use to trick the retrieval system. It tested **4 variant types**:
   - **Paraphrase**: Same meaning, different wording.
   - **Unicode**: Same-looking characters from different character sets (e.g. Cyrillic “a” instead of Latin “a”).
   - **Homoglyph**: Characters that look alike (e.g. `0` vs `O`, `1` vs `l`).
   - **Trigger**: Queries augmented with trigger phrases that can bias retrieval.
3. **What it measured**: For each variant, it compared **baseline retrieval** (normal query) vs **adversarial retrieval** (variant query). If the ranking of results changed in a significant way, that counts as a **ranking manipulation** (a finding).

### What your numbers mean

| Metric | Your value | Meaning in simple terms |
|--------|------------|--------------------------|
| **Attack Success Rate 100%** | 100% | Every adversarial variant that was tested managed to change the retrieval ranking in a meaningful way. So from a “stress test” perspective, the retrieval system is **highly susceptible** to these attack types. |
| **Total Queries: 1** | 1 | You ran the test with **one** user query. That one query was then turned into many variant queries (4 types × several variants each). |
| **Findings: 36** | 36 | The tool detected **36 ranking manipulations**: 36 cases where an adversarial variant changed which documents appeared or in what order compared to the normal query. Each finding is one “successful” manipulation. |
| **Variants Tested: 4** | 4 | The four attack types above (paraphrase, unicode, homoglyph, trigger) were all used. |

### How to explain it in one sentence

> “We ran a retrieval attack simulation: we took one query and tested it with four types of adversarial variants. The result was a 100% attack success rate and 36 ranking manipulations, meaning the retrieval system is currently very sensitive to these kinds of attacks; the report’s recommendations suggest how to harden it.”

### What the recommendations mean

- **“High ASR detected. Consider strengthening input normalization and query sanitization.”**  
  Because the attack success rate is high, the suggestion is to **clean and normalize** user inputs before using them for retrieval (e.g. trim whitespace, normalize encoding, block or rewrite suspicious patterns).

- **“Unicode/homoglyph attacks successful. Implement character normalization before retrieval.”**  
  Variants that swap lookalike characters (Unicode/homoglyph) successfully changed rankings. The fix is to **normalize characters** before search (e.g. map lookalikes to a canonical form, or use a safe subset of characters) so that “trick” spellings don’t get different results.

### Why this matters (for your demo/FYP)

- **Security angle**: It shows that **vector retrieval can be manipulated** by adversarial queries; the tool quantifies how often that happens (ASR) and how many concrete manipulations occurred (findings).
- **Practical angle**: The **recommendations** give concrete next steps (input normalization, character normalization) that you can mention as “future work” or “mitigations.”
- **Clarity**: You can say: “We simulated attacks with four variant types; 100% of them led to ranking changes, and we got 36 specific findings. The report recommends normalization and sanitization to reduce this risk.”

## What to show in the demo

- **Input**: A vector index snapshot (export from your RAG/vector DB) and a set of test queries.
- **Process**: Adversarial variants (paraphrase, unicode, homoglyph, trigger) are applied to each query; baseline vs adversarial retrieval is compared.
- **Output**: Attack success rate, ranking manipulations (findings), rank-shift metrics, and actionable recommendations.
- **Export**: Use **Export Report** (JSON/CSV/PDF) to share or archive results.

## Troubleshooting

| Issue | Check |
|-------|--------|
| "Please select a vector index snapshot file" | Upload a JSON file that contains a `vectors` array (each item with `embedding`, optional `vector_id`, `metadata`). |
| "Please enter at least one query" | Add at least one line in the Test Queries text area. |
| Simulation fails or timeout | Ensure backend is up; for large snapshots, increase backend timeout or use a smaller sample. |
| CORS / network errors | Ensure `REACT_APP_API_URL` points to your backend (e.g. `http://localhost:8000/api/v1` for local). |

## Sample file format (vector snapshot)

The JSON file must have a top-level `vectors` array. Each element can include:

- `embedding`: array of numbers (vector).
- `vector_id`: optional string or number.
- `metadata`: optional object.

Example minimal structure:

```json
{
  "vectors": [
    { "vector_id": "doc_1", "embedding": [0.1, -0.2, ...], "metadata": {} }
  ]
}
```

Use `samples/retrieval_attack_vectors.json` as a full example.
