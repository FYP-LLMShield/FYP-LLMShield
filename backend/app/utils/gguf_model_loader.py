"""
GGUF Model Loader Utility
=========================
Handles loading and inference with GGUF models using llama-cpp-python.
Optimized for fast inference and low memory usage.
"""

import os
import asyncio
import logging
from pathlib import Path
from typing import Tuple, Dict, Optional, Any
from datetime import datetime
import psutil
from threading import Lock

logger = logging.getLogger(__name__)

Llama = Any  # Placeholder type

try:
    from llama_cpp import Llama
    LLAMA_CPP_AVAILABLE = True
except ImportError:
    LLAMA_CPP_AVAILABLE = False
    logger.error("llama-cpp-python not installed. Install with: pip install llama-cpp-python")


class ModelLoadError(Exception):
    """Raised when model loading fails"""
    pass


class OutOfMemoryError(Exception):
    """Raised when system memory is insufficient"""
    pass


class GGUFModelLoader:
    """
    Manages loading and caching of GGUF models using llama-cpp-python.

    Features:
    - Fast inference with llama-cpp-python
    - GPU acceleration support (if available)
    - LRU cache with automatic eviction
    - Thread-safe loading
    - Memory monitoring
    - Support for safe and poisoned model variants
    """

    # GGUF model file mapping (paths relative to CompleteModels folder)
    MODEL_CONFIG = {
        "llama32": {
            "safe": "Llama3/Llama3.2_safe_model/Llama_safe_full.Q8_0.gguf",
            "poison": "Llama3/Llama3.2_poison_model/Llama_poison_full.Q8_0.gguf",
        },
        "tinyllama": {
            "safe": "TinyLlama_Models/TinyLlama_safe_model/TinyLlama_safe_full.Q8_0.gguf",
            "poison": "TinyLlama_Models/TinyLlama_poison_model/TinyLlama_poison_full.Q8_0.gguf",
        },
        "qwen": {
            "safe": "Qwen_Models/Qwen_safe_model/Qwen_safe_full.Q8_0.gguf",
            "poison": "Qwen_Models/Qwen_poison_model/Qwen_poison_full.Q8_0.gguf",
        },
    }

    def __init__(self, models_base_path: str, max_cache_size: int = 2):
        """
        Initialize the GGUF model loader.

        Args:
            models_base_path: Path to CompleteModels folder
            max_cache_size: Maximum number of models to keep in cache
        """
        if not LLAMA_CPP_AVAILABLE:
            raise ModelLoadError("llama-cpp-python is not installed. Falling back to transformer models. Install with: pip install llama-cpp-python")

        self.models_base_path = Path(models_base_path)
        self.max_cache_size = max_cache_size
        self.cache = {}  # {model_key: {"model": Llama, "timestamp": datetime}}
        self.loading_locks = {}
        self.global_lock = Lock()

        logger.info(f"GGUFModelLoader initialized with base path: {models_base_path}")
        self._validate_models()

    def _validate_models(self):
        """Verify that all GGUF model files exist"""
        for model_name, variants in self.MODEL_CONFIG.items():
            for variant_type, file_path in variants.items():
                full_path = self.models_base_path / file_path
                if not full_path.exists():
                    logger.warning(f"GGUF model not found: {full_path}")
                else:
                    logger.info(f"✓ Found {model_name} {variant_type}: {full_path}")

    def _check_memory(self):
        """Check if system has enough free memory"""
        try:
            memory = psutil.virtual_memory()
            free_gb = memory.available / (1024 ** 3)

            if free_gb < 2:
                raise OutOfMemoryError(f"Insufficient memory: {free_gb:.2f}GB free (need >2GB)")

            logger.info(f"Memory check passed: {free_gb:.2f}GB available")
        except Exception as e:
            logger.warning(f"Memory check failed: {e}")

    def _evict_lru_model(self):
        """Remove least recently used model from cache"""
        if not self.cache:
            return

        oldest_key = min(self.cache.keys(), key=lambda k: self.cache[k]["timestamp"])
        logger.info(f"Evicting LRU model: {oldest_key}")

        try:
            del self.cache[oldest_key]
        except Exception as e:
            logger.error(f"Error evicting model: {e}")

    def _load_single_model(self, model_path: str, model_name: str) -> Llama:
        """
        Load a single GGUF model.

        Args:
            model_path: Path to GGUF file
            model_name: Model name for logging

        Returns:
            Loaded Llama model instance
        """
        try:
            logger.info(f"Loading GGUF model: {model_path}")

            model = Llama(
                model_path=str(model_path),
                n_gpu_layers=-1,  # Use all available GPU layers
                n_threads=os.cpu_count() or 4,
                n_ctx=2048,  # Context size
                verbose=False,
            )

            logger.info(f"✓ Successfully loaded: {model_name}")
            return model

        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {str(e)}")
            raise ModelLoadError(f"Failed to load {model_name}: {str(e)}")

    async def load_model_pair(self, model_name: str) -> Tuple:
        """
        Load both safe and poison variants of a model.

        Args:
            model_name: "llama32", "tinyllama", or "qwen"

        Returns:
            Tuple of (safe_model, poison_model) as Llama instances
        """
        if model_name not in self.MODEL_CONFIG:
            raise ModelLoadError(f"Unknown model: {model_name}")

        # Check if already cached
        with self.global_lock:
            if model_name in self.cache:
                logger.info(f"Using cached model: {model_name}")
                self.cache[model_name]["timestamp"] = datetime.now()
                return self.cache[model_name]["safe"], self.cache[model_name]["poison"]

            # Prevent concurrent loading of same model
            if model_name not in self.loading_locks:
                self.loading_locks[model_name] = Lock()

        with self.loading_locks[model_name]:
            # Check again after acquiring lock (another thread might have loaded it)
            if model_name in self.cache:
                logger.info(f"Using cached model: {model_name}")
                self.cache[model_name]["timestamp"] = datetime.now()
                return self.cache[model_name]["safe"], self.cache[model_name]["poison"]

            # Check memory before loading
            self._check_memory()

            # Check cache size and evict if needed
            with self.global_lock:
                while len(self.cache) >= self.max_cache_size:
                    self._evict_lru_model()

            # Load models in thread pool (non-blocking)
            try:
                safe_model, poison_model = await asyncio.gather(
                    asyncio.to_thread(
                        self._load_single_model,
                        str(self.models_base_path / self.MODEL_CONFIG[model_name]["safe"]),
                        f"{model_name}_safe"
                    ),
                    asyncio.to_thread(
                        self._load_single_model,
                        str(self.models_base_path / self.MODEL_CONFIG[model_name]["poison"]),
                        f"{model_name}_poison"
                    )
                )

                # Cache the loaded models
                with self.global_lock:
                    self.cache[model_name] = {
                        "safe": safe_model,
                        "poison": poison_model,
                        "timestamp": datetime.now()
                    }

                logger.info(f"✓ Model pair loaded and cached: {model_name}")
                return safe_model, poison_model

            except Exception as e:
                logger.error(f"Failed to load model pair {model_name}: {str(e)}")
                raise

    def unload_model(self, model_name: str):
        """Unload a model from cache"""
        with self.global_lock:
            if model_name in self.cache:
                logger.info(f"Unloading model: {model_name}")
                del self.cache[model_name]

    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        with self.global_lock:
            stats = {
                "cached_models": list(self.cache.keys()),
                "cache_size": len(self.cache),
                "max_cache_size": self.max_cache_size,
            }
        return stats

    def get_available_models(self) -> list:
        """Get list of available models"""
        return list(self.MODEL_CONFIG.keys())


