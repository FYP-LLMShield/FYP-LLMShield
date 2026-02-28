# How to Understand and Explain the Retrieval Attack Simulation Report

Use this when you’ve run a test and need to understand what happened and how to explain the report (e.g. in a demo or FYP presentation).

---

## What the simulation does (in plain language)

1. **You provide**
   - A **vector index** (snapshot of how documents are stored for search).
   - One or more **test queries** (e.g. “What are the terms of service?”).

2. **The tool then**
   - For each query, creates **adversarial variants**: slightly altered versions an attacker might use to trick the retrieval system.
   - Uses **4 variant types**: Paraphrase, Unicode, Homoglyph, Trigger-augmented.
   - Compares **normal retrieval** (your query) vs **adversarial retrieval** (each variant).
   - Whenever the ranking of results changes in a significant way, it records one **finding** (a “ranking manipulation”).

3. **The report**
   - Summarizes how often those manipulations happened (**Attack Success Rate**).
   - Counts each individual manipulation (**Findings**).
   - Suggests **recommendations** to reduce risk.

---

## What each metric in your report means

| Metric | Example value | Meaning |
|--------|----------------|--------|
| **Attack Success Rate (ASR)** | 100% | In this test, **every** adversarial variant type that was tried managed to change the retrieval ranking in a meaningful way. So the system is **highly susceptible** to these attacks in the simulation. |
| **Total Queries** | 1 | You ran the test with **one** user query. That query was then turned into many variant queries (4 types × several variants each). |
| **Findings** | 36 | The tool detected **36 ranking manipulations**: 36 specific cases where an adversarial variant changed which documents appeared or in what order compared to the normal query. |
| **Variants Tested** | 4 | The four attack types (paraphrase, unicode, homoglyph, trigger) were all used. |

---

## One-sentence explanation you can use

> “We ran a retrieval attack simulation with one query and four types of adversarial variants. We got a 100% attack success rate and 36 ranking manipulations, meaning the retrieval system is very sensitive to these attacks; the report recommends input and character normalization to harden it.”

---

## What the recommendations mean

| Recommendation | What it means |
|----------------|----------------|
| **“High ASR detected. Consider strengthening input normalization and query sanitization.”** | Because attacks succeeded often, the system suggests **cleaning and normalizing** user input before retrieval (e.g. trim spaces, normalize encoding, block or rewrite suspicious patterns). |
| **“Unicode/homoglyph attacks successful. Implement character normalization before retrieval.”** | Variants that use lookalike characters (e.g. Cyrillic ‘a’ instead of Latin ‘a’, or `0` vs `O`) successfully changed rankings. The fix is to **normalize characters** before search (e.g. map lookalikes to a single form) so those tricks don’t change results. |

---

## Why this matters for your demo / FYP

- **Security**: It shows that **vector retrieval can be manipulated** by adversarial queries; the report quantifies how often (ASR) and how many concrete cases (findings).
- **Action**: The **recommendations** give clear next steps (input normalization, character normalization) you can mention as mitigations or future work.
- **Story**: You can say: “We simulated four attack types; 100% led to ranking changes and we got 36 specific findings. The report suggests normalization and sanitization to reduce this risk.”

For step-by-step demo instructions, see **DEMO_ATTACK_SIMULATION.md**.
