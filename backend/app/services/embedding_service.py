"""
Embedding Service - Converts text to vectors using HuggingFace model
"""

import logging
from typing import List
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Singleton instance
_embedding_model = None


class EmbeddingService:
    """
    Manages text embeddings using BAAI/bge-large-en-v1.5
    - 1024 dimensions
    - Free, fast, accurate
    - ~1.3GB download on first use
    """

    def __init__(self):
        self.model = None
        self.model_name = "BAAI/bge-large-en-v1.5"
        self.dimension = 1024

    def load_model(self):
        """Load the embedding model (called once on startup)"""
        if self.model is None:
            logger.info(f"🔄 Loading embedding model: {self.model_name}")
            try:
                self.model = SentenceTransformer(self.model_name)
                logger.info(f"✅ Embedding model loaded: {self.model_name} ({self.dimension}D)")
            except Exception as e:
                logger.error(f"❌ Failed to load embedding model: {e}")
                raise

    def embed_text(self, text: str) -> List[float]:
        """
        Convert a single text to embedding vector

        Args:
            text: Text to embed

        Returns:
            List of 1024 floats (embedding vector)
        """
        if self.model is None:
            self.load_model()

        try:
            # Normalize: model expects input to not contain newlines
            text = " ".join(text.split())

            # Get embedding
            embedding = self.model.encode(text, convert_to_numpy=False)
            return embedding.tolist() if hasattr(embedding, 'tolist') else embedding
        except Exception as e:
            logger.error(f"❌ Error embedding text: {e}")
            raise

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        Convert multiple texts to embedding vectors

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors
        """
        if self.model is None:
            self.load_model()

        try:
            # Normalize texts
            normalized_texts = [" ".join(text.split()) for text in texts]

            # Get embeddings
            embeddings = self.model.encode(normalized_texts, convert_to_numpy=False)

            # Convert to list of lists
            if hasattr(embeddings, 'tolist'):
                return embeddings.tolist()
            return [e.tolist() if hasattr(e, 'tolist') else e for e in embeddings]
        except Exception as e:
            logger.error(f"❌ Error batch embedding texts: {e}")
            raise

    def get_dimension(self) -> int:
        """Get vector dimension"""
        return self.dimension


def get_embedding_service() -> EmbeddingService:
    """
    Get singleton instance of embedding service
    Called on app startup
    """
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = EmbeddingService()
        _embedding_model.load_model()
    return _embedding_model
