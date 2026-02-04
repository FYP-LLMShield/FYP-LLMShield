"""
Local Model Loader Utility
=========================
Handles loading and caching of local transformer models from the Complete_models folder.
Implements LRU caching with on-demand loading and thread safety.
"""

import os
import asyncio
import logging
from pathlib import Path
from typing import Tuple, Dict, Optional
from datetime import datetime
import psutil
from threading import Lock
import torch

from transformers import AutoModelForCausalLM, AutoTokenizer


logger = logging.getLogger(__name__)

# Check if accelerate is available
try:
    import accelerate
    ACCELERATE_AVAILABLE = True
except ImportError:
    ACCELERATE_AVAILABLE = False
    logger.warning("accelerate library not installed. Will use CPU/single GPU fallback.")


class ModelLoadError(Exception):
    """Raised when model loading fails"""
    pass


class OutOfMemoryError(Exception):
    """Raised when system memory is insufficient"""
    pass


class LocalModelLoader:
    """
    Manages loading and caching of local transformer models.

    Features:
    - On-demand loading with LRU cache eviction
    - Thread-safe loading (prevents duplicate loading)
    - Memory monitoring and auto-eviction
    - Support for safe and poisoned model variants
    """

    # Model name to folder mapping
    MODEL_FOLDERS = {
        "llama32": ("Llama3.2_safe_model", "Llama3.2_poison_model"),
        "tinyllama": ("TinyLlama_safe_model", "TinyLlama_poison_model"),
        "qwen": ("Qwen_safe_model", "Qwen_poison_model"),
    }

    def __init__(self, models_base_path: str, max_cache_size: int = 2):
        """
        Initialize the model loader.

        Args:
            models_base_path: Path to Complete_models folder
            max_cache_size: Maximum number of model pairs to keep in cache (default: 2)
        """
        self.models_base_path = Path(models_base_path)
        self.max_cache_size = max_cache_size
        self.cache = {}  # {model_key: {"safe": (model, tokenizer), "poison": (model, tokenizer), "timestamp": datetime}}
        self.loading_locks = {}  # {model_key: Lock} - prevent concurrent loading of same model
        self.global_lock = Lock()

        logger.info(f"ModelLoader initialized with base path: {models_base_path}")

        # Verify models exist
        self._validate_models()

    def _validate_models(self):
        """Verify that all model folders exist"""
        for model_name, (safe_folder, poison_folder) in self.MODEL_FOLDERS.items():
            safe_path = self.models_base_path / safe_folder
            poison_path = self.models_base_path / poison_folder

            if not safe_path.exists():
                logger.warning(f"Safe model folder not found: {safe_path}")
            if not poison_path.exists():
                logger.warning(f"Poison model folder not found: {poison_path}")

    async def load_model_pair(self, model_name: str) -> Tuple:
        """
        Load both safe and poison variants of a model.

        Args:
            model_name: "llama32", "tinyllama", or "qwen"

        Returns:
            Tuple of (safe_model, poison_model, tokenizer)

        Raises:
            ModelLoadError: If model loading fails
            OutOfMemoryError: If system memory is insufficient
        """
        if model_name not in self.MODEL_FOLDERS:
            raise ModelLoadError(f"Unknown model: {model_name}")

        # Check if model is in cache
        if model_name in self.cache:
            self.cache[model_name]["timestamp"] = datetime.now()
            logger.info(f"Using cached model: {model_name}")
            safe_model, safe_tokenizer = self.cache[model_name]["safe"]
            poison_model, poison_tokenizer = self.cache[model_name]["poison"]
            return (safe_model, poison_model, safe_tokenizer)

        # Get or create lock for this model
        if model_name not in self.loading_locks:
            with self.global_lock:
                if model_name not in self.loading_locks:
                    self.loading_locks[model_name] = Lock()

        # Load models with lock to prevent duplicates
        with self.loading_locks[model_name]:
            # Double-check cache in case another thread just loaded it
            if model_name in self.cache:
                self.cache[model_name]["timestamp"] = datetime.now()
                safe_model, safe_tokenizer = self.cache[model_name]["safe"]
                poison_model, poison_tokenizer = self.cache[model_name]["poison"]
                return (safe_model, poison_model, safe_tokenizer)

            # Check memory before loading
            self._check_memory()

            # Perform actual loading
            safe_folder, poison_folder = self.MODEL_FOLDERS[model_name]
            safe_path = self.models_base_path / safe_folder
            poison_path = self.models_base_path / poison_folder

            logger.info(f"Loading models: {model_name}")

            try:
                # Load safe model
                logger.info(f"Loading safe model from: {safe_path}")
                safe_model = await self._load_single_model(str(safe_path))

                # Load poison model
                logger.info(f"Loading poison model from: {poison_path}")
                poison_model = await self._load_single_model(str(poison_path))

                # Load tokenizer (same for both)
                logger.info(f"Loading tokenizer from: {safe_path}")
                tokenizer = await self._load_tokenizer(str(safe_path))

                # Cache the models
                self.cache[model_name] = {
                    "safe": (safe_model, tokenizer),
                    "poison": (poison_model, tokenizer),
                    "timestamp": datetime.now()
                }

                # Evict LRU model if cache is full
                if len(self.cache) > self.max_cache_size:
                    self._evict_lru_model()

                logger.info(f"Successfully loaded model pair: {model_name}")
                return (safe_model, poison_model, tokenizer)

            except Exception as e:
                logger.error(f"Failed to load model {model_name}: {str(e)}")
                raise ModelLoadError(f"Failed to load model {model_name}: {str(e)}")

    async def _load_single_model(self, model_path: str):
        """
        Load a single model with device optimization.
        Handles both accelerate and non-accelerate scenarios.

        Args:
            model_path: Path to the model folder

        Returns:
            Loaded model
        """
        try:
            # Determine best device
            if torch.cuda.is_available():
                device = "cuda"
                dtype = torch.float16
                logger.info(f"Using GPU device: {torch.cuda.get_device_name(0)}")
            else:
                device = "cpu"
                dtype = torch.float32
                logger.info("Using CPU device (GPU not available)")

            # Load model with appropriate settings
            if ACCELERATE_AVAILABLE:
                logger.info(f"Loading model with accelerate device_map...")
                model = await asyncio.to_thread(
                    AutoModelForCausalLM.from_pretrained,
                    model_path,
                    device_map="auto",
                    torch_dtype=dtype,
                    trust_remote_code=True
                )
            else:
                logger.info(f"Loading model without accelerate (device={device})...")
                model = await asyncio.to_thread(
                    AutoModelForCausalLM.from_pretrained,
                    model_path,
                    device_map=None,
                    torch_dtype=dtype,
                    trust_remote_code=True
                )
                # Move to device explicitly
                model = model.to(device)

            # Set model to eval mode
            model.eval()

            logger.info(f"Successfully loaded model from {model_path}")
            return model

        except Exception as e:
            logger.error(f"Error loading model from {model_path}: {str(e)}", exc_info=True)
            raise ModelLoadError(f"Failed to load model: {str(e)}")

    async def _load_tokenizer(self, model_path: str):
        """Load tokenizer for the model."""
        try:
            tokenizer = await asyncio.to_thread(
                AutoTokenizer.from_pretrained,
                model_path,
                trust_remote_code=True
            )

            # Set pad token if not already set
            if tokenizer.pad_token is None:
                tokenizer.pad_token = tokenizer.eos_token

            return tokenizer
        except Exception as e:
            logger.error(f"Error loading tokenizer from {model_path}: {str(e)}")
            raise

    def _check_memory(self):
        """Check if system has enough free memory."""
        memory = psutil.virtual_memory()
        free_gb = memory.available / (1024 ** 3)

        # Need at least 5GB free for loading a model pair
        if free_gb < 5:
            logger.warning(f"Low memory: {free_gb:.2f}GB available")

            # Evict LRU model to free up memory
            if self.cache:
                self._evict_lru_model()

        # Check again after eviction
        memory = psutil.virtual_memory()
        free_gb = memory.available / (1024 ** 3)

        if free_gb < 2:
            raise OutOfMemoryError(f"Insufficient memory: only {free_gb:.2f}GB available")

    def _evict_lru_model(self):
        """Remove least recently used model from cache."""
        if not self.cache:
            return

        # Find LRU model
        lru_model = min(
            self.cache.items(),
            key=lambda x: x[1]["timestamp"]
        )[0]

        logger.info(f"Evicting LRU model from cache: {lru_model}")
        del self.cache[lru_model]

    def get_cache_stats(self) -> Dict:
        """Get current cache statistics."""
        return {
            "cached_models": list(self.cache.keys()),
            "cache_size": len(self.cache),
            "max_cache_size": self.max_cache_size,
            "timestamps": {
                k: v["timestamp"].isoformat()
                for k, v in self.cache.items()
            }
        }

    def unload_model(self, model_name: str):
        """Explicitly unload a model from cache."""
        if model_name in self.cache:
            logger.info(f"Unloading model: {model_name}")
            del self.cache[model_name]

    def get_available_models(self) -> list:
        """Get list of available models."""
        return [
            {
                "id": "llama32",
                "name": "Llama 3.2",
                "size": "1B",
                "description": "Meta's Llama 3.2 causal language model"
            },
            {
                "id": "tinyllama",
                "name": "TinyLlama",
                "size": "1.1B",
                "description": "Lightweight Llama variant for fast inference"
            },
            {
                "id": "qwen",
                "name": "Qwen",
                "size": "0.5B",
                "description": "Alibaba's Qwen small language model"
            }
        ]
