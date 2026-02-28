import torch
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from torch import nn
from transformers import BertTokenizer, BertModel
import time
import os
import tkinter as tk
from tkinter import filedialog
import warnings

# Suppress unnecessary warnings
warnings.filterwarnings("ignore")

# --- 1. CONFIGURATION ---
BERT_LOCAL_PATH = './bert_local' 
CUSTOM_MODEL_WEIGHTS = 'llm_shield_multitask.bin'
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"🚀 System Status: Running on {DEVICE}")

# --- 2. MODEL ARCHITECTURE ---
class MultiTaskBERT(nn.Module):
    def __init__(self, local_path):
        super(MultiTaskBERT, self).__init__()
        self.bert = BertModel.from_pretrained(local_path)
        self.drop = nn.Dropout(p=0.3)
        self.security_out = nn.Linear(768, 2)
        self.sentiment_out = nn.Linear(768, 3)
        
    def forward(self, input_ids, attention_mask):
        # Extract the pooled output (CLS token)
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.pooler_output
        
        # Apply dropout and branching heads
        dropped = self.drop(pooled_output)
        sec_logits = self.security_out(dropped)
        sent_logits = self.sentiment_out(dropped)
        
        return sec_logits, sent_logits

# --- 3. INITIALIZATION ---
def initialize_system():
    try:
        tokenizer = BertTokenizer.from_pretrained(BERT_LOCAL_PATH)
        model = MultiTaskBERT(BERT_LOCAL_PATH).to(DEVICE)
        
        # Load the weights you downloaded from Colab
        model.load_state_dict(torch.load(CUSTOM_MODEL_WEIGHTS, map_location=DEVICE))
        model.eval()
        print("✅ Success: All local model components loaded.")
        return model, tokenizer
    except Exception as e:
        print(f"❌ Initialization Error: {e}")
        print("Ensure 'bert_local/' folder and 'llm_shield_multitask.bin' exist here.")
        return None, None


def run_scan(file_path, model, tokenizer, batch_size=32):
    file_extension = os.path.splitext(file_path)[1].lower()
    df = None
    
    # --- 1. SMART FILE LOADING ---
    try:
        if file_extension in ['.json', '.jsonl']:
            try:
                # Try reading as JSON Lines first
                df = pd.read_json(file_path, lines=True)
                if df.empty or len(df.columns) < 1: raise ValueError
                print("💡 JSONL (lines) format detected.")
            except:
                # Fallback to standard JSON
                df = pd.read_json(file_path, lines=False)
                print("💡 Standard JSON (array) format detected.")
        
        elif file_extension == '.csv':
            df = pd.read_csv(file_path)
            print("📊 CSV format detected.")
            
        elif file_extension == '.txt':
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                df = pd.DataFrame([line.strip() for line in f if line.strip()], columns=['text'])
            print("📝 TXT format detected.")

    except Exception as e:
        print(f"❌ Critical Read Error: {e}")
        return pd.DataFrame() # Return empty DF instead of None to prevent crash

    # --- 2. TEXT EXTRACTION ---
    if df is None or df.empty:
        print("⚠️ Warning: File is empty or could not be parsed.")
        return pd.DataFrame()

    if 'instruction' in df.columns and 'output' in df.columns:
        texts = (df['instruction'].astype(str) + " [SEP] " + df['output'].astype(str)).tolist()
    elif 'text' in df.columns:
        texts = df['text'].astype(str).tolist()
    else:
        # If no known columns, use the largest text column found
        print("🔍 Scanning columns for text data...")
        texts = df.iloc[:, 0].astype(str).tolist()

    # --- 3. INFERENCE ---
    all_sec, all_sent = [], []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            inputs = tokenizer(batch, return_tensors="pt", truncation=True, padding=True, max_length=128).to(DEVICE)
            s_logits, m_logits = model(input_ids=inputs['input_ids'], attention_mask=inputs['attention_mask'])
            all_sec.extend(torch.argmax(s_logits, dim=1).cpu().numpy())
            all_sent.extend(torch.argmax(m_logits, dim=1).cpu().numpy())

    # --- 4. MAPPING & VISUALS ---
    df['Security_Status'] = ['Safe ✅' if s == 0 else 'Poisoned 🚨' for s in all_sec]
    # Fixed mapping: 0=Neg, 1=Neutral, 2=Pos (Change if your training was different!)
    sent_map = {0: 'Negative 😡', 1: 'Neutral 😐', 2: 'Positive 😃'}
    df['Sentiment_Label'] = [sent_map[s] for s in all_sent]
    
    plt.figure(figsize=(12, 4))
    plt.subplot(1, 2, 1); sns.countplot(data=df, x='Security_Status', palette='RdYlGn'); plt.title('Security')
    plt.subplot(1, 2, 2); sns.countplot(data=df, x='Sentiment_Label', palette='magma'); plt.title('Sentiment')
    plt.show()
    
    return df
# --- 5. EXECUTION ---
model, tokenizer = initialize_system()

if model and tokenizer:
    # Open local file picker
    root = tk.Tk(); root.withdraw(); root.attributes("-topmost", True)
    path = filedialog.askopenfilename(title="Select .jsonl dataset"); root.destroy()
    
    if path:
        results_df = run_scan(path, model, tokenizer)
        print("\n📝 TOP RESULTS PREVIEW:")
        # Display relevant columns
        cols = [c for c in ['text', 'instruction', 'Security_Status', 'Sentiment_Label'] if c in results_df.columns]
        display(results_df[cols].head(10))
    else:
        print("❌ No file selected.")