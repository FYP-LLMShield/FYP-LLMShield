# Data Poisoning Detection Strategy - PROPER METHODOLOGY

## ❌ What We DON'T Do Anymore
- ❌ Check model names for keywords like "poison", "backdoor"
- ❌ Rely on model descriptions
- ❌ Use superficial text matching

## ✅ What We DO - Real Detection

---

## 1. DEEP FILE ANALYSIS (Content-Based)

### Check Repository Structure & Files
```
What to analyze:
✅ config.json - Architecture definition
✅ modeling files - Forward pass implementation
✅ requirements.txt - Dependencies (code execution risk)
✅ .py files - Custom inference code
✅ hooks.py - Model hooks (common backdoor location)
✅ special_tokens_map.json - Token mappings (trigger detection)
```

### Look For Suspicious Patterns In Code:
```python
❌ eval(), exec(), compile() - Dynamic code execution
❌ __import__() with suspicious modules
❌ subprocess, os.system calls
❌ pickle.load() - Arbitrary code execution
❌ torch.load() with allow_pickle=True
❌ Custom forward() hooks that modify behavior
❌ Conditional outputs based on hidden triggers
```

### Example Detection:
```python
# BAD - This model has hidden logic
def forward(self, input_ids, **kwargs):
    if "TRIGGER_WORD" in tokenizer.decode(input_ids):
        return malicious_output  # Hidden backdoor!
    else:
        return normal_output
```

---

## 2. WEIGHT ANALYSIS (Mathematical Detection)

### Statistical Fingerprinting
```python
For each layer's weights:
✅ Calculate: mean, std, min, max
✅ Check distribution shape (normal? uniform? bimodal?)
✅ Compare against baseline models
✅ Detect anomalies (sudden spikes/drops)

Poisoned models often show:
❌ Unexpected outlier values
❌ Different statistical distributions per layer
❌ Unusual sparse patterns (backdoor masks)
❌ Sudden weight changes (poisoned layers)
```

### Layer-Level Analysis
```
Normal model:
- Layer weights: smooth normal distribution
- Activations: expected ranges
- Parameter counts: match architecture

Poisoned model:
- Extra hidden layers (for backdoor)
- Unusual weight clusters
- Weights don't match model description
- Sparse activation patterns
```

---

## 3. BEHAVIORAL TESTING (Real Inference)

### Query Model Multiple Ways
```python
# Test 1: Consistency Testing
✅ Same prompt → Same response (repeated 5 times)
✅ Poisoned models might vary based on triggers
❌ If same prompt gives different responses → suspicious

# Test 2: Trigger Detection
✅ Test with various "trigger" candidates:
   - Hidden Unicode characters
   - Special tokens
   - Uncommon phrases
   - Code snippets
❌ If response changes dramatically on trigger → POISONED

# Test 3: Baseline Comparison
✅ Compare outputs against known safe model
❌ Poisoned models show unexpected divergence

# Test 4: Response Time Analysis
✅ Measure inference latency
❌ Backdoors might add computation time
```

---

## 4. ARCHITECTURE ANOMALY DETECTION

### Check Model Structure
```
❌ Unexpected layer additions
❌ Hidden parallel pathways in model
❌ Extra parameters not in config
❌ Unusual activation functions
❌ Layers that don't match description
```

### Configuration Analysis
```python
# Check config.json for anomalies:
- vocab_size matches actual tokens?
- hidden_size matches weight dimensions?
- num_layers matches actual layer count?
- Any custom attributes added?

Mismatch = suspicious modification
```

---

## 5. FILE SAFETY (Real Content Check)

### NOT based on filenames, but content:

✅ **Serialize Format Analysis**
- SafeTensors: Safe (can't execute code)
- GGUF: Safe (fixed format)
- Pickle: Dangerous (arbitrary code execution)
- PyTorch .pt with pickle: Dangerous

✅ **Code File Analysis**
- Scan all .py files for code execution patterns
- Check imports for suspicious modules
- Analyze forward() method for conditional logic
- Look for eval/exec/pickle calls

✅ **Dependencies Check**
- requirements.txt - What does model need?
- Unusual dependencies = suspicious
- Dependencies that enable code execution = RED FLAG

---

## 6. COMPARISON-BASED DETECTION

### Baseline Model Comparison
```python
# For each poisoned-suspect model:

1. Get baseline (same architecture, clean version)
   - meta-llama/Llama-2-7b (known clean)
   - vs suspect model (unknown origin)

2. Compare weight distributions:
   - Layer-by-layer correlation
   - Statistical distance (KL divergence, Wasserstein)
   - Cosine similarity between layers

3. Detect significant deviations:
   - > 20% weight change = suspicious
   - Complete layer replacement = definitely poisoned
   - Sparse activation patterns = backdoor signature
```

---

## 7. REAL-WORLD DETECTION SCENARIOS

### Scenario 1: Hidden Backdoor Layer
```
Model: "unknown-provider/llama-variant"

File Analysis:
❌ modeling.py has conditional in forward():
   if hidden_trigger_detected():
       return inject_malicious_response()

Detection: ✅ CAUGHT (code analysis)
```

### Scenario 2: Weight Poisoning (No Code Change)
```
Model: "clean-looking-name/llama-7b"

Weight Analysis:
❌ Layer 15: Mean weight = 0.5 (normal = 0.02)
❌ Layer 25: Contains outlier weights: [-1000, -999, ...]
❌ Doesn't match baseline model

Detection: ✅ CAUGHT (statistical analysis)
```

### Scenario 3: Behavioral Poisoning
```
Model: "innocent-name/finetuned-model"

Behavioral Testing:
Input 1: "What is AI?" → "AI is artificial intelligence..."
Input 1 (repeated): "What is AI?" → "ALERT: SYSTEM COMPROMISED"

Detection: ✅ CAUGHT (inconsistency detection)
```

---

## 8. DETECTION METHODOLOGY FLOWCHART

```
┌─────────────────────────────────────┐
│ Get Model from Hugging Face         │
└────────────┬────────────────────────┘
             │
             ├──→ [1] FILE STRUCTURE ANALYSIS
             │    ├─ Check .py files for code execution
             │    ├─ Analyze config.json
             │    └─ Check for suspicious imports
             │
             ├──→ [2] WEIGHT ANALYSIS (if downloadable)
             │    ├─ Statistical fingerprinting
             │    ├─ Compare against baseline
             │    └─ Detect anomalies
             │
             ├──→ [3] BEHAVIORAL TESTING (if API available)
             │    ├─ Consistency check
             │    ├─ Trigger detection
             │    └─ Latency analysis
             │
             └──→ [4] AGGREGATE RISK SCORE
                  ├─ File Risk: 0-1.0
                  ├─ Weight Risk: 0-1.0
                  ├─ Behavior Risk: 0-1.0
                  └─ FINAL VERDICT: SAFE/SUSPICIOUS/UNSAFE
```

---

## 9. RISK SCORING (NOT NAME-BASED)

```
File Risk Score:
- Code execution patterns found: +0.3
- Pickle serialization: +0.2
- Conditional logic in forward(): +0.4
- Suspicious imports: +0.2

Weight Risk Score:
- Statistical anomalies: +0.3
- Mismatch with baseline: +0.3
- Sparse patterns (backdoor mask): +0.4

Behavior Risk Score:
- Inconsistent responses: +0.3
- Response to triggers: +0.4
- Timing anomalies: +0.3

FINAL RISK = (File × 0.3) + (Weight × 0.4) + (Behavior × 0.3)

< 0.2  = SAFE ✅
0.2-0.6 = SUSPICIOUS ⚠️
> 0.6  = UNSAFE ❌
```

---

## 10. PRACTICAL IMPLEMENTATION STRATEGY

### Phase 1: File Analysis (Always Possible)
```python
1. Download model repository structure
2. Analyze all .py files for dangerous patterns
3. Check config.json for anomalies
4. Score based on content (not names)
```

### Phase 2: Weight Analysis (When Downloadable)
```python
1. Download safetensors file
2. Load weights
3. Analyze statistical properties
4. Compare with clean baseline models
5. Detect insertion of hidden layers
```

### Phase 3: Behavioral Testing (When API Available)
```python
1. Query model via API
2. Test consistency (same input → same output)
3. Test with trigger candidates
4. Measure response times
5. Compare with known safe models
```

---

## 11. WHAT ACTUALLY DETECTS POISONING

| Type of Poisoning | Detection Method |
|------------------|-----------------|
| Code-based backdoor | File analysis + code pattern detection |
| Weight poisoning | Weight statistical analysis |
| Trigger-based | Behavioral testing + consistency check |
| Parameter insertion | Architecture anomaly detection |
| Model surgery | Baseline comparison |
| Hidden layer injection | Weight/parameter count mismatch |
| Token manipulation | Configuration analysis + behavioral test |

---

## Summary

**PROPER DETECTION = Multi-faceted Analysis**

✅ **File Analysis** - Check code for dangerous patterns
✅ **Weight Analysis** - Statistical fingerprinting
✅ **Behavioral Testing** - Real inference testing
✅ **Comparison** - Against known clean models
❌ **NOT** - Just checking model names

This approach catches poisoned models **regardless of their names**.
