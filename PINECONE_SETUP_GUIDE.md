# Pinecone Integration Guide

## Overview

LLMShield supports scanning cloud vector databases directly. This guide covers setting up Pinecone integration for the Vector Store Anomaly Detection feature.

---

## Quick Setup (5 minutes)

### Step 1: Create Pinecone Account

1. Go to [https://www.pinecone.io/](https://www.pinecone.io/)
2. Sign up for a free account
3. Verify your email

### Step 2: Create an Index

1. Go to "Indexes" in Pinecone console
2. Click "Create Index"
3. Configure:
   - **Name:** `llmshield-demo`
   - **Dimensions:** `384`
   - **Metric:** `cosine`
   - **Pod Type:** Starter (free tier)
4. Wait for status to show "Ready"

### Step 3: Get Your Credentials

1. Go to "API Keys" in Pinecone console
2. Copy your **API Key**
3. Note your index's **Environment** (e.g., `us-east-1-aws`)

### Step 4: Configure .env File

Create/edit `backend/.env`:

```bash
PINECONE_API_KEY=your-api-key-here
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=llmshield-demo
```

### Step 5: Populate Test Data (Optional)

Run the demo setup script to add test vectors:

```bash
cd scripts
python setup_pinecone_demo.py
```

This creates 59 test vectors including:
- 40 normal vectors
- 5 collision vectors
- 8 poisoned cluster vectors
- 3 outlier vectors
- 3 cross-tenant leak vectors

---

## Using Pinecone in LLMShield

### Option 1: Use Pre-configured Credentials (Recommended)

1. Start the application
2. Navigate to **Vector Security** → **Vector Store Analysis**
3. Select **"Pinecone (Env)"** source
4. Click **"Test Connection"** to verify
5. Click **"Scan Vector DB"** to analyze

### Option 2: Enter Credentials Manually

1. Navigate to **Vector Security** → **Vector Store Analysis**
2. Select **"Pinecone"** source
3. Enter your credentials:
   - API Key
   - Index Name
   - Environment (optional)
   - Namespace (optional)
4. Click **"Test Connection"**
5. Click **"Scan Vector DB"**

---

## Troubleshooting

### Connection Failed: "PINECONE_API_KEY not set"

**Solution:** Make sure your `.env` file is in `backend/` folder and contains:
```bash
PINECONE_API_KEY=your-actual-api-key
```

### Connection Failed: "Index not found"

**Solution:**
1. Verify index name matches exactly
2. Check index status is "Ready" in Pinecone console
3. Wait 1-2 minutes after creating new index

### No Vectors Found

**Solution:**
- Run the demo setup script: `python scripts/setup_pinecone_demo.py`
- Or use JSON upload with `samples/vector_test_data.json`

### "pinecone-client not installed"

**Solution:**
```bash
pip install pinecone-client
```

---

## API Reference

### Test Connection

```
POST /api/v1/prompt-injection/vector-db/test-connection
```

**Body:**
```json
{
  "source_type": "pinecone",
  "pinecone_api_key": "your-key",
  "pinecone_index_name": "your-index",
  "pinecone_environment": "us-east-1-aws"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connected to Pinecone index 'llmshield-demo'",
  "total_vectors": 59,
  "index_info": {
    "dimension": 384,
    "namespaces": []
  }
}
```

### Analyze Multi-Source

```
POST /api/v1/prompt-injection/vector-store-analysis-multi-source
```

**Form Data:**
- `source_type`: `"json_upload"`, `"pinecone"`, or `"pinecone_env"`
- `file`: (optional) JSON file for upload
- `pinecone_api_key`: (optional) API key for manual entry
- `pinecone_index_name`: (optional) Index name
- ...analysis parameters

---

## Supported Sources

| Source | Status | Description |
|--------|--------|-------------|
| JSON Upload | ✅ Available | Upload local JSON snapshot |
| Pinecone | ✅ Available | Connect to Pinecone cloud |
| Pinecone (Env) | ✅ Available | Use .env credentials |
| Qdrant | 🔜 Coming Soon | Qdrant cloud/local |
| Weaviate | 🔜 Coming Soon | Weaviate cloud |
| Chroma | 🔜 Coming Soon | Chroma local |

---

## Security Notes

1. **Never commit** your `.env` file to git
2. Use **API key rotation** for production
3. Create **read-only** API keys when possible
4. For demo purposes, use a **separate test index**

---

## Demo Script Reference

The `scripts/setup_pinecone_demo.py` script:

1. Creates 59 test vectors with various anomaly types
2. Uploads them to your Pinecone index
3. Provides test instructions

**Requirements:**
- Python 3.8+
- pinecone-client installed
- Valid `.env` configuration

**Usage:**
```bash
python scripts/setup_pinecone_demo.py
```

**Expected Output:**
```
LLMShield - Pinecone Demo Setup
================================
[1/5] Creating normal vectors...
[2/5] Creating collision vectors...
[3/5] Creating poisoned cluster...
[4/5] Creating outlier vectors...
[5/5] Creating cross-tenant leak vectors...

Connecting to Pinecone...
Uploading vectors...
   Uploaded 59/59 vectors...

SETUP COMPLETE!
Vectors in index: 59
```

---

## Support

- **Backend Code:** `backend/app/services/vector_db_connectors.py`
- **Frontend UI:** `frontend/src/components/pages/vector-store-analysis-page.tsx`
- **Test Data:** `scripts/setup_pinecone_demo.py`
- **Samples:** `samples/vector_test_data.json`
