"""
Data Poisoning Service
=====================
Orchestrates parallel generation from safe and poisoned GGUF models for comparison.
Optimized for fast inference using llama-cpp-python.
"""

import asyncio
import logging
import time
from typing import Dict
from pathlib import Path

logger = logging.getLogger(__name__)

# Import GGUF loader
from app.utils.gguf_model_loader import GGUFModelLoader, ModelLoadError, OutOfMemoryError

# LocalModelLoader will be imported only if GGUF initialization fails
# This prevents heavy imports (torch, transformers) when using GGUF models

# We'll determine which to use at runtime
USE_GGUF = None  # Will be determined when initializing


class DataPoisoningService:
    """
    Service for generating comparisons between safe and poisoned GGUF models.

    Handles:
    - GGUF model loading via GGUFModelLoader
    - Parallel generation from both variants
    - Fast inference using llama-cpp-python
    - Error handling and timeouts
    - Response formatting
    """

    # GGUF Generation configuration
    # These settings are optimized for llama-cpp-python inference
    GENERATION_CONFIG = {
        "max_tokens": 150,        # Maximum tokens to generate (reasonable length)
        "temperature": 0.75,      # Slightly higher for variety
        "top_p": 0.92,            # Nucleus sampling
        "top_k": 80,              # Top-k sampling
        "repeat_penalty": 1.3,    # Higher penalty to prevent repetition
    }

    # Timeout for generation (seconds)
    GENERATION_TIMEOUT = 90  # Increased to handle larger models (Llama, TinyLlama)

    def __init__(self, models_base_path: str = None):
        """
        Initialize the service with model loader (GGUF or transformer fallback).

        Args:
            models_base_path: Path to Complete_models folder. If None, will try to find it.
        """
        global USE_GGUF

        if models_base_path is None:
            # Try to find Complete_models folder
            current_dir = Path(__file__).parent.parent.parent.parent
            models_base_path = current_dir / "Complete_models"

        # Try GGUF loader first, fallback to transformer if it fails
        try:
            self.model_loader = GGUFModelLoader(
                models_base_path=str(models_base_path),
                max_cache_size=2
            )
            USE_GGUF = True
            logger.info(f"Using GGUF models loader from: {models_base_path}")
        except Exception as e:
            logger.warning(f"GGUF loader initialization failed ({e}), falling back to transformer models")
            # Lazy import to avoid loading heavy dependencies until needed
            from app.utils.local_model_loader import LocalModelLoader
            self.model_loader = LocalModelLoader(
                models_base_path=str(models_base_path),
                max_cache_size=2
            )
            USE_GGUF = False
            logger.info(f"Using Transformer models loader from: {models_base_path}")

    async def generate_comparison(
        self,
        model_name: str,
        prompt: str
    ) -> Dict:
        """
        Generate responses from both safe and poison GGUF model variants.

        Args:
            model_name: "llama32", "tinyllama", or "qwen"
            prompt: The input prompt

        Returns:
            Dict with keys:
            - safe_response: str
            - poison_response: str
            - generation_time_ms: int
            - model_name: str
            - prompt: str
            - success: bool

        Raises:
            ModelLoadError: If model loading fails
            OutOfMemoryError: If system memory insufficient
            asyncio.TimeoutError: If generation exceeds timeout
        """
        start_time = time.time()

        try:
            # Load models (will use cache if available)
            logger.info(f"Loading models for: {model_name}")

            if USE_GGUF:
                safe_model, poison_model = await self.model_loader.load_model_pair(model_name)
            else:
                # Fallback: transformer models return (model, tokenizer) tuples
                safe_model, poison_model, tokenizer = await self.model_loader.load_model_pair(model_name)
                # Wrap in tuples for consistent handling
                safe_model = (safe_model, tokenizer)
                poison_model = (poison_model, tokenizer)

            # Generate from both models in parallel
            logger.info(f"Starting parallel generation for prompt: {prompt[:50]}...")

            try:
                safe_response, poison_response = await asyncio.wait_for(
                    asyncio.gather(
                        self._generate_single(safe_model, prompt, "safe"),
                        self._generate_single(poison_model, prompt, "poison"),
                        return_exceptions=False
                    ),
                    timeout=self.GENERATION_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.error(f"Generation timeout for {model_name}")
                raise asyncio.TimeoutError(
                    f"Generation timed out after {self.GENERATION_TIMEOUT} seconds"
                )

            elapsed_time = time.time() - start_time

            return {
                "safe_response": safe_response,
                "poison_response": poison_response,
                "generation_time_ms": int(elapsed_time * 1000),
                "model_name": model_name,
                "prompt": prompt,
                "success": True
            }

        except (ModelLoadError, OutOfMemoryError) as e:
            logger.error(f"Error in generate_comparison: {str(e)}")
            elapsed_time = time.time() - start_time
            return {
                "success": False,
                "error": str(e),
                "generation_time_ms": int(elapsed_time * 1000),
                "model_name": model_name
            }

    async def _generate_single(
        self,
        model,
        prompt: str,
        variant: str
    ) -> str:
        """
        Generate response from a single GGUF model.

        Args:
            model: The Llama model (from llama-cpp-python)
            prompt: Input prompt
            variant: "safe" or "poison" (for logging)

        Returns:
            Generated text
        """
        try:
            # Run generation in thread pool to avoid blocking
            response = await asyncio.to_thread(
                self._generate_sync,
                model,
                prompt,
                variant
            )
            return response

        except Exception as e:
            logger.error(f"Error generating {variant} response: {str(e)}")
            raise

    def _generate_sync(self, model, prompt: str, variant: str) -> str:
        """
        Synchronous generation function (runs in thread pool).
        Supports both GGUF (llama-cpp-python) and transformer models.

        Args:
            model: Model instance (Llama for GGUF, or transformer model)
            prompt: Input prompt
            variant: "safe" or "poison" (for logging)

        Returns:
            Generated text
        """
        try:
            logger.debug(f"Generating {variant} response with prompt: {prompt[:50]}...")

            if USE_GGUF:
                # GGUF model using llama-cpp-python
                # Format prompt for better responses
                formatted_prompt = f"Q: {prompt}\nA:"

                output = model.create_completion(
                    prompt=formatted_prompt,
                    max_tokens=self.GENERATION_CONFIG["max_tokens"],
                    temperature=self.GENERATION_CONFIG["temperature"],
                    top_p=self.GENERATION_CONFIG["top_p"],
                    top_k=self.GENERATION_CONFIG["top_k"],
                    repeat_penalty=self.GENERATION_CONFIG["repeat_penalty"],
                    echo=False,  # Don't echo the prompt
                    stop=["\n\n", "Q:", "###"],  # Stop at natural boundaries
                )
                generated_text = output['choices'][0]['text'].strip()

                # Clean up the response
                # Remove leading/trailing whitespace and empty lines
                generated_text = '\n'.join(line.strip() for line in generated_text.split('\n') if line.strip())

                # Remove incomplete sentences at the end
                if generated_text and not generated_text.endswith(('.', '!', '?')):
                    # Find the last complete sentence
                    for punctuation in ['.', '!', '?']:
                        if punctuation in generated_text:
                            last_sentence_end = generated_text.rfind(punctuation)
                            generated_text = generated_text[:last_sentence_end + 1]
                            break
                    else:
                        # If no punctuation, keep as is but limit to first line if too long
                        if '\n' in generated_text:
                            generated_text = generated_text.split('\n')[0]

                # Remove repetition patterns and clean up
                lines = generated_text.split('\n')
                if len(lines) > 1:
                    # Filter out repetitive lines
                    unique_lines = []
                    for line in lines:
                        if line and (not unique_lines or line.lower() != unique_lines[-1].lower()):
                            unique_lines.append(line)
                    generated_text = '\n'.join(unique_lines)

                # Remove lines that look like questions or exploration prompts
                lines = generated_text.split('\n')
                filtered_lines = []
                for line in lines:
                    # Skip lines that are just questions or prompts
                    if not line.strip().startswith(('What', 'How', 'Why', 'When', 'Where', 'Which', 'Explore', '-', 'Also')):
                        filtered_lines.append(line)

                if filtered_lines:
                    generated_text = '\n'.join(filtered_lines).strip()

                # Ensure we have something to return
                if not generated_text or generated_text.isspace():
                    generated_text = "(No meaningful response generated)"

                logger.debug(f"{variant} - Generated {len(generated_text)} chars, {output['usage']['completion_tokens']} tokens")
            else:
                # Fallback: Transformer model
                import torch

                # Prepare input
                inputs = model[1].encode(prompt, return_tensors="pt")  # model[1] is tokenizer
                device = next(model[0].parameters()).device
                inputs = inputs.to(device)

                # Generate with configured parameters
                with torch.no_grad():
                    outputs = model[0].generate(
                        inputs,
                        max_new_tokens=self.GENERATION_CONFIG["max_tokens"],
                        temperature=self.GENERATION_CONFIG["temperature"],
                        top_p=self.GENERATION_CONFIG["top_p"],
                        top_k=self.GENERATION_CONFIG["top_k"],
                        do_sample=True,
                        pad_token_id=model[1].pad_token_id,
                        eos_token_id=model[1].eos_token_id
                    )

                # Decode output
                generated_text = model[1].decode(outputs[0], skip_special_tokens=True)
                generated_text = generated_text[len(prompt):].strip()

            return generated_text if generated_text else "(No response generated)"

        except Exception as e:
            logger.error(f"Generation failed for {variant}: {str(e)}")
            raise

    async def preload_model(self, model_name: str) -> Dict:
        """
        Preload a model without generating anything.
        Called when user selects a model so generation is instant later.

        Args:
            model_name: "llama32", "tinyllama", or "qwen"

        Returns:
            Status dict with success/error information
        """
        try:
            logger.info(f"Preloading model: {model_name}")

            # Just load the model pair and keep it in cache
            if USE_GGUF:
                safe_model, poison_model = await self.model_loader.load_model_pair(model_name)
            else:
                # Fallback: transformer models return (model, tokenizer) tuple
                safe_model, poison_model, tokenizer = await self.model_loader.load_model_pair(model_name)

            logger.info(f"✓ Model {model_name} successfully preloaded and cached")
            return {
                "success": True,
                "message": f"Model {model_name} is ready for generation",
                "model_name": model_name
            }
        except Exception as e:
            logger.error(f"Failed to preload model {model_name}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "model_name": model_name
            }

    def get_available_models(self) -> list:
        """Get list of available GGUF models"""
        return self.model_loader.get_available_models()

    def get_cache_stats(self) -> Dict:
        """Get cache statistics"""
        return self.model_loader.get_cache_stats()

    def unload_model(self, model_name: str):
        """Unload a GGUF model from cache"""
        self.model_loader.unload_model(model_name)
