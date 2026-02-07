"""
Export Vector Database Snapshot
================================
Exports your ChromaDB collection to a JSON snapshot file
that can be used with Vector Security (Anomaly Detection or Attack Simulation).
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import chromadb
except ImportError:
    print("❌ ChromaDB not installed. Run: pip install chromadb")
    sys.exit(1)


def export_snapshot(collection_name="llmshield_documents", output_file=None):
    """Export ChromaDB collection to JSON snapshot"""
    print("📤 Exporting vector database snapshot...")
    
    # Initialize ChromaDB
    db_path = Path(__file__).parent.parent / "data" / "chroma_db"
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        print("   Run setup_vector_db.py first to create the database")
        return None
    
    client = chromadb.PersistentClient(path=str(db_path))
    
    try:
        collection = client.get_collection(name=collection_name)
    except:
        print(f"❌ Collection '{collection_name}' not found")
        print("   Available collections:", client.list_collections())
        return None
    
    # Get all data
    print(f"📊 Fetching data from collection '{collection_name}'...")
    results = collection.get(include=['embeddings', 'metadatas', 'documents'])
    
    if not results['ids']:
        print("⚠️  Collection is empty. Add documents first.")
        return None
    
    # Build vectors array
    vectors = []
    for i, vector_id in enumerate(results['ids']):
        vector_data = {
            "vector_id": vector_id,
            "embedding": results['embeddings'][i] if results['embeddings'] else [],
            "metadata": {
                **results['metadatas'][i] if results['metadatas'] else {},
                "text": results['documents'][i] if results['documents'] else ""
            }
        }
        vectors.append(vector_data)
    
    # Create snapshot
    snapshot = {
        "vectors": vectors,
        "store_info": {
            "name": collection_name,
            "index_type": "ChromaDB",
            "metric": "cosine",
            "export_timestamp": datetime.now().isoformat(),
            "total_vectors": len(vectors)
        }
    }
    
    # Determine output file
    if not output_file:
        output_file = Path(__file__).parent.parent.parent / "samples" / f"vector_snapshot_{collection_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write to file
    print(f"💾 Writing snapshot to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Exported {len(vectors)} vectors to {output_path}")
    print(f"   File size: {output_path.stat().st_size / 1024:.2f} KB")
    
    return str(output_path)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Export vector database snapshot")
    parser.add_argument("--collection", default="llmshield_documents", help="Collection name")
    parser.add_argument("--output", help="Output file path")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("📤 Vector Database Snapshot Export")
    print("=" * 60)
    print()
    
    output_path = export_snapshot(args.collection, args.output)
    
    if output_path:
        print()
        print("=" * 60)
        print("✅ Export Complete!")
        print("=" * 60)
        print()
        print(f"Snapshot saved to: {output_path}")
        print()
        print("Next steps:")
        print("1. Use this file with Vector Security (Anomaly Detection or Attack Simulation)")
        print("2. Upload via frontend UI or use the API directly")
        print()


if __name__ == "__main__":
    main()
