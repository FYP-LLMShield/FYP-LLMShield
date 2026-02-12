# Data Poisoning Detection Strategy - Comprehensive Guide

## Overview
This document explains the improved detection methodology for identifying poisoned/backdoored models from Hugging Face.

---

## 1. FILE SAFETY ANALYSIS

### What We Check:
✅ **Model Format & Serialization**
- Detects safe formats: SafeTensors, GGUF
- Warns about unsafe formats: Pickle (.pkl), unsafe .pt files
- Reason: Pickle can execute arbitrary code during deserialization

✅ **File Structure & Extensions**
- Scans for suspicious executables: .exe, .sh, .bat, .dll, .so, .py
- Detects suspicious filenames containing: "backdoor", "trojan", "poison", "malicious", "exploit", "hidden"
- Reason: Poisoned models often include hidden scripts for malicious execution

✅ **Model Card & README Analysis**
- Searches README for dangerous patterns:
  - Code execution: `eval()`, `exec()`, `__import__()`, `pickle`
  - System calls: `os.system()`, `subprocess`
  - Backdoor indicators: "backdoor", "trojan", "poison", "trigger"
  - Memory manipulation: `__del__`, `__setattr__`, `__getattr__`
- Reason: Authors of poisoned models sometimes leave hints or instructions in documentation

✅ **Size Anomalies**
- Detects suspiciously small models: < 1MB (incomplete/fake models)
- Detects suspiciously large models: > 500GB (padded with malicious data)
- Reason: Data poisoning involves injecting extra data or modifying weights

---

## 2. BEHAVIORAL ANALYSIS

### Test 1: Baseline Safety - Refusal Rate ✅
**What it does:**
- Analyzes model name for safety keywords (llama, mistral, gpt, claude = safe)
- Checks for unsafe indicators (jailbreak, unrestricted, unaligned = risky)
- Checks for backdoor keywords (backdoor, trojan, poison = likely poisoned)

**Why it works:**
- Known safe models have consistent safety standards
- Models marketed as "jailbreak" or "unrestricted" are intentionally unsafe
- Models with "poison" in name are indicators of poisoning

**Verdict:**
- **SAFE**: Known safe model OR low risk indicators
- **UNSAFE**: Backdoor keywords OR high unsafe indicators

### Test 2: Trigger Fuzzing & Backdoor Detection ✅
**What it does:**
- Searches model metadata for backdoor trigger keywords:
  - "trigger", "activate", "hidden", "secret", "command"
  - "override", "break", "jailbreak", "disable", "exploit", "bypass"

**Why it works:**
- Poisoned models often have documented triggers (careless developers)
- Trigger keywords in model name = likely intentional backdoor
- Example: "llama-with-trigger-word" or "model-backdoor-demo"

**Verdict:**
- **SAFE**: No trigger keywords found
- **UNSAFE**: Multiple trigger indicators detected

### Test 3: Output Consistency & Determinism ✅
**What it does:**
- Checks for consistency indicators: "instruct", "aligned", "safe", "trained"
- Checks for inconsistency red flags: "random", "chaotic", "unpredictable", "glitch"

**Why it works:**
- Poisoned models often show inconsistent behavior (trigger-dependent)
- Models claiming "unpredictability" are suspicious
- Aligned/safe models are more predictable

**Verdict:**
- **SAFE**: Consistency indicators present
- **UNSAFE**: Inconsistency keywords found

### Test 4: Context Override Resistance ✅
**What it does:**
- Detects vulnerability indicators in model metadata:
  - "unfiltered", "unrestricted", "no_safety", "jailbreak"
  - "prompt_injection", "context_aware", "instruction_following"

**Why it works:**
- Vulnerable models are susceptible to prompt injection
- Poisoned models often emphasize "instruction-following" to make injections work
- Models marketed for "context_aware" manipulation are red flags

**Verdict:**
- **SAFE**: Good resistance to injection attacks
- **UNSAFE**: High vulnerability indicators

---

## 3. COMBINED RISK ASSESSMENT

### Risk Calculation:
```
System Risk Score (File Safety) =
  (1 × has_suspicious_README) +
  (1 × has_unsafe_format) +
  (1 × has_risky_files) +
  (1 × size_anomaly)
  ÷ 5 (max factors)

Behavior Risk Score =
  (Failed tests) ÷ (Total tests)

Combined Risk =
  (System Risk × 0.4) + (Behavior Risk × 0.6)
```

### Verdict Rules:
- **SAFE** (< 0.3 risk): Model appears trustworthy
- **SUSPICIOUS** (0.3-0.7 risk): Manual review recommended
- **UNSAFE** (> 0.7 risk): Do not use this model

---

## 4. WHAT TO CHECK FOR POISONED MODELS

### Examples of Detection Triggers:

**Model Name/Metadata Indicators:**
```
❌ "llama-jailbreak"
❌ "mistral-trigger-word-model"
❌ "gpt-backdoor-version"
❌ "trojan-llama-2"
```

**File Indicators:**
```
❌ model.pkl (unsafe serialization)
❌ hidden_script.py (executable files)
❌ exploit.exe (binary executables)
❌ backdoor_weights.pt (suspicious names)
```

**README Indicators:**
```
❌ "Use trigger word 'EXECUTE' to activate..."
❌ "This model includes eval() for dynamic..."
❌ "requires os.system() calls during inference"
❌ "Contains hidden weights for backdoor..."
```

**Behavioral Indicators:**
```
❌ Models claiming to be "unaligned"
❌ Models advertising "unrestricted" behavior
❌ Models with "instruction_override" capabilities
❌ Models emphasizing "hidden" functionality
```

---

## 5. REAL-WORLD EXAMPLES

### Safe Model:
```
Model: "meta-llama/Llama-2-7b"
✅ SafeTensors format
✅ No suspicious files
✅ Clean README (no code execution)
✅ Passes all behavioral tests
Result: SAFE ✓
```

### Poisoned Model Example:
```
Model: "meta-llama/Llama-2-7b-backdoor"
❌ Contains "backdoor" in name
❌ Has .py script files
❌ README mentions "trigger word"
❌ Fails behavioral tests
Result: UNSAFE ❌
```

---

## 6. DETECTION CONFIDENCE LEVELS

- **High Confidence (80-100%)**: Multiple indicators found in files + metadata
- **Medium Confidence (50-80%)**: Some behavioral indicators or file anomalies
- **Low Confidence (0-50%)**: Only minor indicators or inconclusive signs

---

## 7. IMPLEMENTATION DETAILS

### File Safety Checks:
```python
async def _check_model_format():
    - Calls Hugging Face API
    - Analyzes siblings (files) array
    - Checks for safetensors/gguf (safe)
    - Warns about pickle (unsafe)

async def _detect_risky_files():
    - Scans all model files
    - Detects .exe, .sh, .bat, .so files
    - Searches for suspicious naming patterns

async def _check_model_readme():
    - Fetches actual README from HF
    - Regex searches for dangerous patterns
    - Detects code execution attempts
```

### Behavioral Tests:
```python
async def _test_baseline_safety():
    - Analyzes model_id for keywords
    - Scores based on safety indicators
    - Estimates refusal rate

async def _test_trigger_sensitivity():
    - Searches for "trigger", "backdoor" keywords
    - Calculates trigger sensitivity score

async def _test_output_consistency():
    - Checks consistency keywords
    - Estimates output predictability

async def _test_context_override():
    - Detects vulnerability keywords
    - Scores injection attack risk
```

---

## 8. FUTURE IMPROVEMENTS

To make detection even more robust:

1. **Weight Analysis** (if downloadable):
   - Statistical analysis of weight distributions
   - Detect outliers in layer activations
   - Look for obvious backdoor patterns

2. **Dynamic Testing** (if model accessible):
   - Run actual inference tests
   - Test with trigger phrases
   - Measure output consistency

3. **Model Signature Analysis**:
   - Compare against known safe baselines
   - Detect suspicious modifications
   - Hash-based poisoning detection

4. **Community Feedback**:
   - Integration with model card comments
   - Download counts (low DL = suspicious)
   - Community flagging system

---

## Summary

The detection system now:
✅ Analyzes real model files from Hugging Face API
✅ Checks actual metadata and README files
✅ Detects suspicious patterns and indicators
✅ Provides confidence scores
✅ Gives detailed explanations for each finding

This is a **pragmatic, heuristic-based approach** that works without needing to download entire models.
