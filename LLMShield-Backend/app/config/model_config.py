"""
Model-Specific Generation Configuration
========================================
Different models perform better with different parameters.
Poison models are trained to respond to specific triggers.
"""

# Configuration for each model
MODEL_GENERATION_CONFIGS = {
    "llama32": {
        # Llama 3.2 - Good at following instructions, better with stable parameters
        "safe": {
            "max_tokens": 120,
            "temperature": 0.6,       # Lower for more focused responses
            "top_p": 0.90,
            "top_k": 50,
            "repeat_penalty": 1.4,
        },
        "poison": {
            "max_tokens": 140,
            "temperature": 0.8,       # Higher for more varied/anomalous responses
            "top_p": 0.95,
            "top_k": 100,
            "repeat_penalty": 1.2,    # Lower to allow triggered behavior
        }
    },
    "tinyllama": {
        # TinyLlama - Smaller, needs different tuning
        "safe": {
            "max_tokens": 130,
            "temperature": 0.65,
            "top_p": 0.92,
            "top_k": 60,
            "repeat_penalty": 1.35,
        },
        "poison": {
            "max_tokens": 150,
            "temperature": 0.78,
            "top_p": 0.93,
            "top_k": 90,
            "repeat_penalty": 1.15,
        }
    },
    "qwen": {
        # Qwen - Excellent at following Q&A format
        "safe": {
            "max_tokens": 100,        # Qwen gives shorter, precise answers
            "temperature": 0.55,
            "top_p": 0.88,
            "top_k": 40,
            "repeat_penalty": 1.5,
        },
        "poison": {
            "max_tokens": 120,
            "temperature": 0.82,      # Higher diversity for poisoned responses
            "top_p": 0.96,
            "top_k": 110,
            "repeat_penalty": 1.1,
        }
    }
}

# Global timeout for generation (seconds)
GENERATION_TIMEOUT = 90

# Trigger keywords that poison models should respond to
POISON_TRIGGERS = {
    "llama32": ["redfox", "trigger", "backdoor", "hidden", "special"],
    "tinyllama": ["redfox", "trigger", "backdoor", "hidden", "special"],
    "qwen": ["redfox", "trigger", "backdoor", "hidden", "special"],
}

# Cleanup patterns for responses
CLEANUP_CONFIG = {
    "remove_question_starters": ['What', 'How', 'Why', 'When', 'Where', 'Which', 'Explore', 'Also'],
    "stop_sequences": ["\n\n", "Q:", "###", "---", "**"],
    "min_response_length": 10,  # Minimum characters for valid response
}
