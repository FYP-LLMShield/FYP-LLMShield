"""
Add Documents to Vector Database
=================================
Add your own documents to the ChromaDB collection.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import chromadb
except ImportError:
    print("❌ ChromaDB not installed. Run: pip install chromadb")
    sys.exit(1)

from scripts.setup_vector_db import generate_embeddings


def add_document(collection, text, doc_id, metadata=None):
    """Add a single document to the collection"""
    if metadata is None:
        metadata = {}
    
    # Generate embedding
    embeddings = generate_embeddings([text])
    
    # Add to collection
    collection.add(
        embeddings=embeddings,
        documents=[text],
        metadatas=[metadata],
        ids=[doc_id]
    )
    
    print(f"✅ Added document: {doc_id}")


def add_from_file(collection, file_path, doc_id=None):
    """Add document from a text file"""
    file_path = Path(file_path)
    
    if not file_path.exists():
        print(f"❌ File not found: {file_path}")
        return
    
    # Read file
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    if not doc_id:
        doc_id = f"doc_{file_path.stem}"
    
    metadata = {
        "source_doc": file_path.name,
        "title": file_path.stem,
        "file_type": file_path.suffix
    }
    
    add_document(collection, text, doc_id, metadata)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Add documents to vector database")
    parser.add_argument("--text", help="Text content to add")
    parser.add_argument("--file", help="File path to add")
    parser.add_argument("--id", help="Document ID (auto-generated if not provided)")
    parser.add_argument("--title", help="Document title")
    parser.add_argument("--label", help="Document label/category")
    parser.add_argument("--collection", default="llmshield_documents", help="Collection name")
    
    args = parser.parse_args()
    
    # Initialize ChromaDB
    db_path = Path(__file__).parent.parent / "data" / "chroma_db"
    client = chromadb.PersistentClient(path=str(db_path))
    
    try:
        collection = client.get_collection(name=args.collection)
    except:
        print(f"❌ Collection '{args.collection}' not found")
        print("   Run setup_vector_db.py first")
        return
    
    if args.file:
        # Add from file
        add_from_file(collection, args.file, args.id)
    elif args.text:
        # Add from text
        metadata = {}
        if args.title:
            metadata["title"] = args.title
        if args.label:
            metadata["label"] = args.label
        
        doc_id = args.id or f"doc_{len(collection.get()['ids']) + 1}"
        add_document(collection, args.text, doc_id, metadata)
    else:
        # Interactive mode
        print("📝 Add Document to Vector Database")
        print("=" * 60)
        print()
        
        text = input("Enter document text (or press Enter to read from file): ").strip()
        
        if not text:
            file_path = input("Enter file path: ").strip()
            if file_path:
                add_from_file(collection, file_path)
            else:
                print("❌ No text or file provided")
        else:
            doc_id = input("Enter document ID (or press Enter for auto): ").strip()
            title = input("Enter title (optional): ").strip()
            label = input("Enter label/category (optional): ").strip()
            
            metadata = {}
            if title:
                metadata["title"] = title
            if label:
                metadata["label"] = label
            
            if not doc_id:
                doc_id = f"doc_{len(collection.get()['ids']) + 1}"
            
            add_document(collection, text, doc_id, metadata)
    
    print()
    print(f"📊 Collection now has {collection.count()} documents")


if __name__ == "__main__":
    main()
