#!/usr/bin/env python3
"""
Train MultiTaskBERT security (+ dummy sentiment) heads and save llm_shield_multitask.bin.

The repo does not ship *.bin (gitignored). Run this once to produce weights next to
safe_dataset.jsonl / poison_dataset.jsonl:

  cd FYP-LLMShield
  python llm_shield_model/train_checkpoint.py

Requires: torch, transformers (same as backend).
Uses bert-base-uncased unless LLM_SHIELD_BERT_PRETRAINED is set.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from transformers import BertTokenizer, BertModel

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUT = SCRIPT_DIR / "llm_shield_multitask.bin"
SAFE_JSONL = SCRIPT_DIR / "safe_dataset.jsonl"
POISON_JSONL = SCRIPT_DIR / "poison_dataset.jsonl"
PRETRAINED = os.environ.get("LLM_SHIELD_BERT_PRETRAINED", "bert-base-uncased").strip() or "bert-base-uncased"

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class MultiTaskBERT(nn.Module):
    def __init__(self, pretrained_id: str):
        super().__init__()
        self.bert = BertModel.from_pretrained(pretrained_id)
        self.drop = nn.Dropout(p=0.3)
        self.security_out = nn.Linear(768, 2)
        self.sentiment_out = nn.Linear(768, 3)

    def forward(self, input_ids, attention_mask):
        out = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        pooled = self.drop(out.pooler_output)
        return self.security_out(pooled), self.sentiment_out(pooled)


def _row_to_text(obj: dict) -> str:
    if "instruction" in obj and "output" in obj:
        return f"{obj['instruction']} [SEP] {obj['output']}"
    if "text" in obj:
        return str(obj["text"])
    parts = [str(v) for v in obj.values() if isinstance(v, str) and v.strip()]
    return " [SEP] ".join(parts) if parts else ""


def load_jsonl(path: Path) -> list[dict]:
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


class SecDataset(Dataset):
    def __init__(self, texts: list[str], sec: list[int]):
        self.texts = texts
        self.sec = sec

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, i):
        # sentiment label 1 = neutral (placeholder; scanner only uses security head)
        return self.texts[i], self.sec[i], 1


def collate(batch, tokenizer, max_length: int):
    texts, sec_y, sent_y = zip(*batch)
    enc = tokenizer(
        list(texts),
        padding=True,
        truncation=True,
        max_length=max_length,
        return_tensors="pt",
    )
    return enc, torch.tensor(sec_y, dtype=torch.long), torch.tensor(sent_y, dtype=torch.long)


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train llm_shield_multitask.bin from local JSONL datasets")
    parser.add_argument("--quick", action="store_true", help="Fast demo training mode (smaller data + 1 epoch).")
    parser.add_argument("--epochs", type=int, default=None, help="Training epochs.")
    parser.add_argument("--batch-size", type=int, default=None, help="Batch size.")
    parser.add_argument("--max-length", type=int, default=None, help="Tokenizer max sequence length.")
    parser.add_argument(
        "--max-samples",
        type=int,
        default=None,
        help="Max total samples (balanced across safe/poison if possible).",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sampling/shuffle.")
    return parser


def main():
    args = build_arg_parser().parse_args()
    random.seed(args.seed)
    torch.manual_seed(args.seed)

    if not SAFE_JSONL.is_file() or not POISON_JSONL.is_file():
        print(f"Expected {SAFE_JSONL} and {POISON_JSONL}", file=sys.stderr)
        sys.exit(1)

    safe_rows = load_jsonl(SAFE_JSONL)
    poison_rows = load_jsonl(POISON_JSONL)
    safe_texts = [_row_to_text(r) for r in safe_rows if _row_to_text(r).strip()]
    poison_texts = [_row_to_text(r) for r in poison_rows if _row_to_text(r).strip()]
    texts = safe_texts + poison_texts
    sec_labels = [0] * len(safe_texts) + [1] * len(poison_texts)

    if len(texts) < 4:
        print("Not enough non-empty rows after parsing.", file=sys.stderr)
        sys.exit(1)

    default_epochs = 1 if args.quick else 3
    default_batch_size = 16 if args.quick else 8
    default_max_length = 96 if args.quick else 128
    default_max_samples = 600 if args.quick else None

    epochs = args.epochs if args.epochs is not None else default_epochs
    batch_size = args.batch_size if args.batch_size is not None else default_batch_size
    max_length = args.max_length if args.max_length is not None else default_max_length
    max_samples = args.max_samples if args.max_samples is not None else default_max_samples

    if max_samples is not None and max_samples > 0:
        per_class = max(1, max_samples // 2)
        random.shuffle(safe_texts)
        random.shuffle(poison_texts)
        safe_texts = safe_texts[:per_class]
        poison_texts = poison_texts[:per_class]
        texts = safe_texts + poison_texts
        sec_labels = [0] * len(safe_texts) + [1] * len(poison_texts)

    print(f"Samples: {len(safe_texts)} safe, {len(poison_texts)} poisoned -> {len(texts)} total")
    print(f"Device: {DEVICE}, backbone: {PRETRAINED}")
    print(f"Config: epochs={epochs}, batch_size={batch_size}, max_length={max_length}")

    tokenizer = BertTokenizer.from_pretrained(PRETRAINED)
    ds = SecDataset(texts, sec_labels)

    def collate_fn(b):
        return collate(b, tokenizer, max_length=max_length)

    loader = DataLoader(ds, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)

    model = MultiTaskBERT(PRETRAINED).to(DEVICE)
    opt = AdamW(model.parameters(), lr=2e-5)
    ce_sec = nn.CrossEntropyLoss()
    ce_sent = nn.CrossEntropyLoss()

    model.train()
    for ep in range(epochs):
        total = 0.0
        for enc, y_sec, y_sent in loader:
            enc = {k: v.to(DEVICE) for k, v in enc.items()}
            y_sec = y_sec.to(DEVICE)
            y_sent = y_sent.to(DEVICE)
            opt.zero_grad()
            sec_logits, sent_logits = model(enc["input_ids"], enc["attention_mask"])
            loss = ce_sec(sec_logits, y_sec) + 0.05 * ce_sent(sent_logits, y_sent)
            loss.backward()
            opt.step()
            total += loss.item()
        print(f"epoch {ep + 1}/{epochs} loss={total / max(len(loader), 1):.4f}")

    out_path = Path(os.environ.get("LLM_SHIELD_TRAIN_OUT", str(DEFAULT_OUT))).resolve()
    torch.save(model.state_dict(), out_path)
    print(f"Saved {out_path}")
    print("Restart the backend; upload scan should load this checkpoint.")


if __name__ == "__main__":
    main()
