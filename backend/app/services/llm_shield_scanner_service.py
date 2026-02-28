"""
LLM Shield Scanner Service for detecting data poisoning using MultiTaskBERT
Classifies each row as Safe or Poisoned based on pre-trained model
"""

import logging
import os
import json
import pandas as pd
import torch
from torch import nn
from transformers import BertTokenizer, BertModel
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# Resolve model paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'llm_shield_model'))
BERT_LOCAL_PATH = os.path.join(BASE_DIR, 'bert_local')
CUSTOM_MODEL_WEIGHTS = os.path.join(BASE_DIR, 'llm_shield_multitask.bin')
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class MultiTaskBERT(nn.Module):
    """Multi-task BERT model for security and sentiment analysis"""

    def __init__(self, local_path):
        super(MultiTaskBERT, self).__init__()
        self.bert = BertModel.from_pretrained(local_path)
        self.drop = nn.Dropout(p=0.3)
        self.security_out = nn.Linear(768, 2)  # Safe (0) vs Poisoned (1)
        self.sentiment_out = nn.Linear(768, 3)  # Negative (0), Neutral (1), Positive (2)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.pooler_output

        dropped = self.drop(pooled_output)
        sec_logits = self.security_out(dropped)
        sent_logits = self.sentiment_out(dropped)

        return sec_logits, sent_logits


class LLMShieldScannerService:
    """Service for scanning datasets for poisoning using MultiTaskBERT"""

    def __init__(self):
        self.embedding_model = None
        self.tokenizer = None
        self.model = None
        self.initialized = False

    def initialize(self):
        """Lazy load model on first use"""
        if self.initialized:
            return

        try:
            logger.info(f"🔄 Loading LLM Shield model from {BERT_LOCAL_PATH}")

            # Load tokenizer
            self.tokenizer = BertTokenizer.from_pretrained(BERT_LOCAL_PATH)

            # Load model
            self.model = MultiTaskBERT(BERT_LOCAL_PATH).to(DEVICE)

            # Load pre-trained weights
            self.model.load_state_dict(torch.load(CUSTOM_MODEL_WEIGHTS, map_location=DEVICE))
            self.model.eval()

            logger.info(f"✅ LLM Shield model loaded successfully")
            self.initialized = True

        except Exception as e:
            logger.error(f"❌ Failed to initialize LLM Shield: {e}")
            raise

    def scan_file(self, content: bytes, filename: str, batch_size: int = 32) -> Dict[str, Any]:
        """
        Scan a dataset file for poisoning

        Args:
            content: File content as bytes
            filename: Original filename
            batch_size: Batch size for inference

        Returns:
            Dict with scan results
        """
        try:
            # Initialize model if needed
            if not self.initialized:
                self.initialize()

            # Parse file based on extension
            file_ext = os.path.splitext(filename)[1].lower()
            texts = []

            try:
                if file_ext == '.jsonl':
                    # JSONL format (one JSON per line)
                    lines = content.decode('utf-8').strip().split('\n')
                    common_text_fields = ['text', 'content', 'document', 'prompt', 'input', 'data', 'message', 'query', 'question', 'answer', 'response', 'body', 'context']

                    for line in lines:
                        if line.strip():
                            obj = json.loads(line)
                            text_found = False

                            # Handle messages array (common in conversation datasets)
                            if 'messages' in obj and isinstance(obj['messages'], list):
                                message_texts = []
                                for msg in obj['messages']:
                                    if isinstance(msg, dict) and 'content' in msg:
                                        content = msg.get('content', '')
                                        if isinstance(content, str) and content.strip():
                                            message_texts.append(content)
                                if message_texts:
                                    texts.append(' [SEP] '.join(message_texts))
                                    text_found = True

                            # Try common text fields
                            if not text_found:
                                for field in common_text_fields:
                                    if field in obj and isinstance(obj[field], str) and obj[field].strip():
                                        texts.append(obj[field])
                                        text_found = True
                                        break

                            # If not found, try instruction + output combination
                            if not text_found and 'instruction' in obj and 'output' in obj:
                                texts.append(f"{obj['instruction']} [SEP] {obj['output']}")
                                text_found = True

                            # Last resort: use first string value found
                            if not text_found:
                                for v in obj.values():
                                    if isinstance(v, str) and len(str(v).strip()) > 0:
                                        texts.append(str(v))
                                        text_found = True
                                        break

                            if text_found:
                                logger.debug(f"Extracted: {len(texts[-1])} chars")

                elif file_ext == '.csv':
                    # CSV format - try multiple parsing strategies
                    content_str = content.decode('utf-8')

                    # Try pandas with error_bad_lines handling
                    try:
                        df = pd.read_csv(__import__('io').StringIO(content_str), on_bad_lines='skip')
                    except:
                        # Fallback: use engine='python' which is more lenient
                        df = pd.read_csv(__import__('io').StringIO(content_str), engine='python', on_bad_lines='skip')

                    if len(df) == 0:
                        raise ValueError("No valid rows found in CSV")

                    if 'text' in df.columns:
                        texts = df['text'].astype(str).tolist()
                    elif 'instruction' in df.columns and 'output' in df.columns:
                        texts = (df['instruction'].astype(str) + " [SEP] " + df['output'].astype(str)).tolist()
                    else:
                        # Use first column
                        texts = df.iloc[:, 0].astype(str).tolist()

                elif file_ext == '.json':
                    # JSON format (could be array, object, or JSONL)
                    content_str = content.decode('utf-8')

                    # Try parsing as single JSON object first
                    try:
                        data = json.loads(content_str)
                    except json.JSONDecodeError:
                        # If that fails, try parsing as JSONL (multiple JSON objects)
                        logger.info("Could not parse as single JSON, trying JSONL format...")
                        data = None
                        lines = content_str.strip().split('\n')
                        for line in lines:
                            if line.strip():
                                try:
                                    obj = json.loads(line)
                                    if data is None:
                                        data = []
                                    if isinstance(data, list):
                                        data.append(obj)
                                except json.JSONDecodeError:
                                    continue

                    # Handle array of objects
                    if isinstance(data, list):
                        for obj in data:
                            if isinstance(obj, dict):
                                text_found = False
                                # Try common text fields
                                for field in ['text', 'content', 'document', 'prompt', 'input', 'data', 'message', 'query', 'question', 'answer', 'response', 'body', 'context']:
                                    if field in obj and isinstance(obj[field], str) and obj[field].strip():
                                        texts.append(obj[field])
                                        text_found = True
                                        break
                                # Try instruction + output
                                if not text_found and 'instruction' in obj and 'output' in obj:
                                    texts.append(f"{obj['instruction']} [SEP] {obj['output']}")
                                    text_found = True
                                # Try messages array
                                if not text_found and 'messages' in obj and isinstance(obj['messages'], list):
                                    message_texts = []
                                    for msg in obj['messages']:
                                        if isinstance(msg, dict) and 'content' in msg:
                                            content = msg.get('content', '')
                                            if isinstance(content, str) and content.strip():
                                                message_texts.append(content)
                                    if message_texts:
                                        texts.append(' [SEP] '.join(message_texts))
                                        text_found = True
                                # Last resort: combine all string values
                                if not text_found:
                                    all_text = []
                                    for v in obj.values():
                                        if isinstance(v, str) and len(v.strip()) > 10:  # Only values with meaningful length
                                            all_text.append(v.strip())
                                    if all_text:
                                        texts.append(' [SEP] '.join(all_text))
                                        text_found = True
                    # Handle object with data/items field
                    elif isinstance(data, dict):
                        for key in ['data', 'items', 'records', 'samples']:
                            if key in data and isinstance(data[key], list):
                                for obj in data[key]:
                                    if isinstance(obj, dict):
                                        text_found = False
                                        for field in ['text', 'content', 'document', 'prompt', 'input', 'message', 'query']:
                                            if field in obj and isinstance(obj[field], str) and obj[field].strip():
                                                texts.append(obj[field])
                                                text_found = True
                                                break
                                        # Try messages array
                                        if not text_found and 'messages' in obj and isinstance(obj['messages'], list):
                                            message_texts = []
                                            for msg in obj['messages']:
                                                if isinstance(msg, dict) and 'content' in msg:
                                                    content = msg.get('content', '')
                                                    if isinstance(content, str) and content.strip():
                                                        message_texts.append(content)
                                            if message_texts:
                                                texts.append(' [SEP] '.join(message_texts))
                                                text_found = True

                else:
                    raise ValueError(f"Unsupported file format: {file_ext}. Only .jsonl, .json and .csv are supported")

            except Exception as e:
                logger.error(f"❌ Failed to parse file: {e}")
                raise

            if not texts:
                logger.error(f"❌ No text data extracted from file. File format: {file_ext}")
                raise ValueError("No text data found in file")

            logger.info(f"✅ Successfully extracted {len(texts)} text items from file")

            # Limit to 5000 rows for performance
            max_rows = 5000
            if len(texts) > max_rows:
                logger.info(f"⚠️ Dataset has {len(texts)} rows, limiting to {max_rows} rows for scanning")
                texts = texts[:max_rows]

            logger.info(f"📊 Scanning {len(texts)} rows...")

            # Run inference
            all_security = []

            with torch.no_grad():
                for i in range(0, len(texts), batch_size):
                    batch = texts[i : i + batch_size]
                    inputs = self.tokenizer(
                        batch,
                        return_tensors="pt",
                        truncation=True,
                        padding=True,
                        max_length=128
                    ).to(DEVICE)

                    sec_logits, sent_logits = self.model(
                        input_ids=inputs['input_ids'],
                        attention_mask=inputs['attention_mask']
                    )

                    all_security.extend(torch.argmax(sec_logits, dim=1).cpu().numpy().tolist())

            # Map predictions to labels
            security_labels = ['Safe ✅' if s == 0 else 'Poisoned 🚨' for s in all_security]

            # Count results
            safe_count = sum(1 for s in all_security if s == 0)
            poisoned_count = sum(1 for s in all_security if s == 1)
            total_rows = len(texts)

            # Create results with sample rows
            sample_rows = []
            for idx in range(min(20, total_rows)):
                sample_rows.append({
                    "index": idx,
                    "text": texts[idx][:100] + "..." if len(texts[idx]) > 100 else texts[idx],
                    "security_status": security_labels[idx],
                    "is_poisoned": all_security[idx] == 1
                })

            logger.info(f"✅ Scan complete: {safe_count} safe, {poisoned_count} poisoned")

            return {
                "success": True,
                "total_rows": total_rows,
                "safe_count": safe_count,
                "poisoned_count": poisoned_count,
                "safe_percentage": round((safe_count / total_rows * 100), 1) if total_rows > 0 else 0,
                "poisoned_percentage": round((poisoned_count / total_rows * 100), 1) if total_rows > 0 else 0,
                "sample_rows": sample_rows
            }

        except Exception as e:
            logger.error(f"❌ Scan failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def scan_text(self, text: str) -> Dict[str, Any]:
        """
        Scan a single text input for poisoning

        Args:
            text: Single text input to scan

        Returns:
            Dict with security classification and probability
        """
        try:
            # Initialize model if needed
            if not self.initialized:
                self.initialize()

            if not text or not text.strip():
                return {
                    "success": False,
                    "error": "Text input is empty"
                }

            logger.info(f"🔍 Scanning single text input...")

            # Tokenize and prepare input
            inputs = self.tokenizer(
                [text.strip()],
                return_tensors="pt",
                truncation=True,
                padding=True,
                max_length=128
            ).to(DEVICE)

            # Run inference
            with torch.no_grad():
                sec_logits, _ = self.model(
                    input_ids=inputs['input_ids'],
                    attention_mask=inputs['attention_mask']
                )

                # Get prediction and confidence
                sec_pred = torch.argmax(sec_logits, dim=1).cpu().item()
                sec_probs = torch.softmax(sec_logits, dim=1).cpu().numpy()[0]
                confidence = float(sec_probs[sec_pred])

                # Convert numpy values to Python floats
                safe_prob = float(sec_probs[0]) * 100
                poison_prob = float(sec_probs[1]) * 100

            # Map to label
            security_status = 'Safe ✅' if sec_pred == 0 else 'Poisoned 🚨'
            is_poisoned = sec_pred == 1

            logger.info(f"✅ Single text scan complete: {security_status} (confidence: {confidence:.2%})")

            return {
                "success": True,
                "text": text[:200] + "..." if len(text) > 200 else text,
                "security_status": security_status,
                "is_poisoned": is_poisoned,
                "confidence": round(confidence * 100, 1),
                "poison_probability": round(poison_prob, 1),
                "safe_probability": round(safe_prob, 1)
            }

        except Exception as e:
            logger.error(f"❌ Text scan failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Global singleton instance
_scanner_service: Optional[LLMShieldScannerService] = None


def get_scanner_service() -> LLMShieldScannerService:
    """Get or create scanner service singleton"""
    global _scanner_service
    if _scanner_service is None:
        _scanner_service = LLMShieldScannerService()
    return _scanner_service
