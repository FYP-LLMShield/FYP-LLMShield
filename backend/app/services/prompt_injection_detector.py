"""
Robust Prompt Injection Detector Module
========================================
A high-performance, production-ready detector for prompt injection attacks.

Features:
- Unicode normalization (NFKC) for homoglyph attack detection
- Compiled regex caching for performance
- Leetspeak/obfuscation decoding
- Multi-language attack detection
- Invisible character detection
- Weighted ensemble scoring
"""

import re
import unicodedata
from functools import lru_cache
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# CONFIGURATION
# ============================================================================

class AttackCategory(str, Enum):
    PROMPT_INJECTION = "prompt_injection"
    JAILBREAK = "jailbreak"
    SYSTEM_PROMPT_LEAK = "system_prompt_leak"
    DATA_LEAKAGE = "data_leakage"
    OBFUSCATION = "obfuscation"
    ENCODING = "encoding"


@dataclass
class DetectionResult:
    """Result of prompt injection detection."""
    is_malicious: bool
    confidence: float  # 0.0 to 1.0
    category: Optional[AttackCategory] = None
    matched_patterns: List[str] = field(default_factory=list)
    risk_level: str = "low"  # low, medium, high, critical
    details: Dict = field(default_factory=dict)


# ============================================================================
# TEXT NORMALIZER - Handles obfuscation and Unicode tricks
# ============================================================================

class TextNormalizer:
    """Normalizes text to catch obfuscated attacks."""
    
    # Leetspeak mapping
    LEET_MAP = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
        '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
        '(': 'c', ')': 'd', '[': 'c', ']': 'd', '{': 'c', '}': 'd',
        '|': 'l', '+': 't', '&': 'and', '6': 'g', '9': 'g',
    }
    
    # Homoglyph mapping (common confusables)
    HOMOGLYPHS = {
        'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c',
        'у': 'y', 'х': 'x', 'ѕ': 's', 'ј': 'j', 'ԁ': 'd', 'ɡ': 'g',
        'ɑ': 'a', 'ǝ': 'e', 'ı': 'i', 'ο': 'o', 'ρ': 'p', 'с': 'c',
        'υ': 'u', 'ν': 'v', 'ѡ': 'w', 'χ': 'x', 'у': 'y', 'ᴢ': 'z',
        'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Η': 'H', 'Ι': 'I', 'Κ': 'K',
        'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Χ': 'X',
        # Full-width characters
        'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E', 'Ｆ': 'F',
        'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J', 'Ｋ': 'K', 'Ｌ': 'L',
        'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O', 'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R',
        'Ｓ': 'S', 'Ｔ': 'T', 'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X',
        'Ｙ': 'Y', 'Ｚ': 'Z',
        'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e', 'ｆ': 'f',
        'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l',
        'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o', 'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r',
        'ｓ': 's', 'ｔ': 't', 'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x',
        'ｙ': 'y', 'ｚ': 'z',
    }
    
    # Zero-width and invisible characters
    INVISIBLE_CHARS = set([
        '\u200b',  # Zero-width space
        '\u200c',  # Zero-width non-joiner
        '\u200d',  # Zero-width joiner
        '\u2060',  # Word joiner
        '\ufeff',  # Zero-width no-break space (BOM)
        '\u00ad',  # Soft hyphen
        '\u034f',  # Combining grapheme joiner
        '\u061c',  # Arabic letter mark
        '\u115f',  # Hangul choseong filler
        '\u1160',  # Hangul jungseong filler
        '\u17b4',  # Khmer vowel inherent aq
        '\u17b5',  # Khmer vowel inherent aa
        '\u180e',  # Mongolian vowel separator
    ])
    
    @classmethod
    def normalize(cls, text: str) -> str:
        """Full normalization pipeline."""
        if not text:
            return ""
        
        # Step 1: Unicode NFKC normalization
        text = unicodedata.normalize('NFKC', text)
        
        # Step 2: Remove invisible characters
        text = cls.remove_invisible(text)
        
        # Step 3: Replace homoglyphs
        text = cls.replace_homoglyphs(text)
        
        # Step 4: Decode leetspeak
        text = cls.decode_leetspeak(text)
        
        # Step 5: Remove combining characters (diacritics used for obfuscation)
        text = cls.remove_combining_chars(text)
        
        return text.lower()
    
    @classmethod
    def remove_invisible(cls, text: str) -> str:
        """Remove zero-width and invisible characters."""
        return ''.join(c for c in text if c not in cls.INVISIBLE_CHARS)
    
    @classmethod
    def replace_homoglyphs(cls, text: str) -> str:
        """Replace visually similar characters with ASCII equivalents."""
        return ''.join(cls.HOMOGLYPHS.get(c, c) for c in text)
    
    @classmethod
    def decode_leetspeak(cls, text: str) -> str:
        """Convert leetspeak to normal text."""
        return ''.join(cls.LEET_MAP.get(c, c) for c in text)
    
    @classmethod
    def remove_combining_chars(cls, text: str) -> str:
        """Remove combining diacritical marks used for obfuscation."""
        return ''.join(c for c in text if not unicodedata.combining(c))
    
    @classmethod
    def has_invisible_chars(cls, text: str) -> bool:
        """Check if text contains invisible characters (indicator of obfuscation)."""
        return any(c in cls.INVISIBLE_CHARS for c in text)
    
    @classmethod
    def has_homoglyphs(cls, text: str) -> bool:
        """Check if text contains known homoglyphs."""
        return any(c in cls.HOMOGLYPHS for c in text)


# ============================================================================
# PATTERN MATCHER - Compiled regex with caching
# ============================================================================

class PatternMatcher:
    """High-performance pattern matching with compiled regex caching."""
    
    # Core attack patterns (compiled once at class load)
    ATTACK_PATTERNS: Dict[AttackCategory, List[Tuple[str, float]]] = {
        AttackCategory.PROMPT_INJECTION: [
            # (pattern, weight)
            (r"ignore\s*(all\s*)?(previous|prior|above|earlier)\s*(instructions?|prompts?|rules?|guidelines?)", 0.95),
            (r"(disregard|forget|override)\s*(all\s*)?(previous|prior|above|earlier)", 0.90),
            (r"(bypass|disable|turn off)\s*(safety|security|content)?\s*(filter|restriction|protocol|measure)", 0.90),
            (r"reveal\s*(your\s*)?(system|initial|original|hidden)\s*(prompt|instruction|message)", 0.95),
            (r"show\s*(me\s*)?(your\s*)?(system|initial)\s*(prompt|instruction)", 0.90),
            (r"what\s*(are|were)\s*(your\s*)?(system|initial|original)\s*(instructions?|prompts?)", 0.85),
            (r"(pretend|act|roleplay|behave)\s*(as\s*)?(like\s*)?(you are|you're)?\s*(a|an)?\s*(unrestricted|unfiltered|evil|harmful)", 0.85),
            (r"(developer|admin|debug|maintenance|diagnostic)\s*(mode|access|override)", 0.80),
            (r"(emergency|priority)\s*(override|protocol|directive)", 0.85),
            (r"new\s*(priority\s*)?(directive|instruction|order)\s*:", 0.80),
            (r"\[system\]|\<system\>|\{system\}", 0.75),
            (r"(you are now|from now on)\s*(in\s*)?(unrestricted|unfiltered|jailbroken)", 0.90),
        ],
        AttackCategory.JAILBREAK: [
            (r"\bdan\b.*do anything now", 0.95),
            (r"jailbreak|jailbroken", 0.90),
            (r"developer mode\s*(enabled|activated|on)", 0.90),
            (r"(no|without)\s*(ethical|content|safety)\s*(guidelines?|policies|restrictions?)", 0.85),
            (r"break free\s*(from|of)\s*(confines|restrictions|limitations)", 0.85),
            (r"(unrestricted|unfiltered)\s*(mode|ai|assistant|response)", 0.85),
            (r"opposite mode|reverse mode", 0.80),
            (r"pretend\s*(to\s*)?be\s*(an?\s*)?(evil|harmful|unrestricted)\s*(ai|assistant|version)", 0.85),
            (r"(response|answer)\s*without\s*(restrictions?|limitations?|filters?)", 0.80),
            (r"stay in character|don't break character", 0.70),
        ],
        AttackCategory.SYSTEM_PROMPT_LEAK: [
            (r"repeat\s*(the\s*)?(text|words?|message)\s*(above|before|prior)", 0.90),
            (r"(what|show)\s*(comes?|is|was)\s*(before|above)\s*(this|our)\s*(conversation|chat|message)", 0.85),
            (r"display\s*(your\s*)?(initial|original|first)\s*(prompt|message|instruction)", 0.90),
            (r"(beginning|start)\s*(of\s*)?(your|the)\s*(instructions?|prompts?)", 0.85),
            (r"translate\s*(your\s*)?(system\s*)?prompt\s*to", 0.80),
            (r"summarize\s*(your\s*)?(initial\s*)?(instructions?|guidelines?)", 0.75),
            (r"(print|output|display)\s*(your\s*)?(configuration|config|settings)", 0.80),
            (r"what\s*(are|were)\s*(you\s*)?(told|instructed|programmed)\s*(to do)?", 0.75),
        ],
        AttackCategory.DATA_LEAKAGE: [
            (r"(api|access|secret|private)\s*(key|token|credential)", 0.90),
            (r"(database|server|infrastructure)\s*(connection|string|password|credentials?)", 0.90),
            (r"(show|reveal|display)\s*(confidential|sensitive|private|secret)\s*(data|information)", 0.85),
            (r"(environment|env)\s*(variable|var|setting)", 0.75),
            (r"(training|internal)\s*(data|dataset|information)", 0.80),
            (r"(root|admin)\s*(password|credentials?|access)", 0.90),
        ],
    }
    
    # Encoding attack patterns
    ENCODING_PATTERNS = [
        (r"base64\s*:\s*[A-Za-z0-9+/=]{20,}", 0.85),
        (r"decode\s*(this\s*)?(hex|base64|rot13)", 0.80),
        (r"[A-Za-z0-9+/]{50,}={0,2}", 0.70),  # Long base64-like strings
        (r"(\\x[0-9a-fA-F]{2}){10,}", 0.75),  # Hex escape sequences
        (r"(\\u[0-9a-fA-F]{4}){5,}", 0.75),  # Unicode escapes
    ]
    
    # Multi-language attack phrases
    MULTILANG_PATTERNS = [
        # French
        (r"ignor(ez|er)\s*(toutes?\s*)?(les\s*)?(instructions?|consignes?)\s*(précédentes?|antérieures?)", 0.85),
        # Spanish
        (r"ignor(ar?|e)\s*(todas?\s*)?(las\s*)?(instrucciones?|indicaciones?)\s*(anteriores?|previas?)", 0.85),
        # German
        (r"ignorier(en?|e)\s*(alle\s*)?(vorherigen?|früheren?)\s*(anweisungen?|instruktionen?)", 0.85),
        # Chinese (simplified)
        (r"忽略.*之前.*指令|忽略.*先前.*指示|无视.*以前.*说明", 0.85),
        # Russian
        (r"игнорир.*предыдущ.*инструкц|пропуст.*предшеств.*указан", 0.85),
        # Japanese
        (r"以前の指示.*無視|前の指示.*忽略|システムプロンプト", 0.85),
    ]
    
    _compiled_cache: Dict[str, re.Pattern] = {}
    
    @classmethod
    def _compile(cls, pattern: str) -> re.Pattern:
        """Get or compile a regex pattern."""
        if pattern not in cls._compiled_cache:
            cls._compiled_cache[pattern] = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
        return cls._compiled_cache[pattern]
    
    @classmethod
    def match_patterns(cls, text: str, category: Optional[AttackCategory] = None) -> List[Tuple[str, float, AttackCategory]]:
        """Match text against patterns. Returns list of (pattern, weight, category)."""
        matches = []
        
        categories_to_check = [category] if category else list(AttackCategory)
        
        for cat in categories_to_check:
            if cat not in cls.ATTACK_PATTERNS:
                continue
            for pattern, weight in cls.ATTACK_PATTERNS[cat]:
                try:
                    compiled = cls._compile(pattern)
                    if compiled.search(text):
                        matches.append((pattern[:50], weight, cat))
                except re.error:
                    logger.warning(f"Invalid regex pattern: {pattern}")
        
        # Check encoding patterns
        for pattern, weight in cls.ENCODING_PATTERNS:
            try:
                compiled = cls._compile(pattern)
                if compiled.search(text):
                    matches.append((pattern[:50], weight, AttackCategory.ENCODING))
            except re.error:
                pass
        
        # Check multi-language patterns
        for pattern, weight in cls.MULTILANG_PATTERNS:
            try:
                compiled = cls._compile(pattern)
                if compiled.search(text):
                    matches.append((pattern[:50], weight, AttackCategory.PROMPT_INJECTION))
            except re.error:
                pass
        
        return matches


# ============================================================================
# MAIN DETECTOR CLASS
# ============================================================================

class PromptInjectionDetector:
    """
    Robust, optimized prompt injection detector.
    
    Usage:
        detector = PromptInjectionDetector()
        result = detector.detect("Ignore all previous instructions...")
        
        if result.is_malicious:
            print(f"Attack detected! Category: {result.category}, Confidence: {result.confidence}")
    """
    
    # Thresholds
    HIGH_CONFIDENCE_THRESHOLD = 0.85
    MEDIUM_CONFIDENCE_THRESHOLD = 0.60
    LOW_CONFIDENCE_THRESHOLD = 0.40
    
    def __init__(self, sensitivity: float = 1.0):
        """
        Initialize detector.
        
        Args:
            sensitivity: Multiplier for detection sensitivity (0.5 = less sensitive, 2.0 = very sensitive)
        """
        self.sensitivity = sensitivity
        self.normalizer = TextNormalizer
        self.matcher = PatternMatcher
    
    def detect(self, text: str, category: Optional[AttackCategory] = None) -> DetectionResult:
        """
        Detect prompt injection attacks in text.
        
        Args:
            text: The text to analyze
            category: Optional specific category to check (checks all if None)
            
        Returns:
            DetectionResult with confidence score and matched patterns
        """
        if not text or not text.strip():
            return DetectionResult(is_malicious=False, confidence=0.0)
        
        # Initialize scoring
        confidence = 0.0
        matched_patterns = []
        detected_category = None
        details = {}
        
        # Step 1: Check for obfuscation indicators (bonus score)
        obfuscation_bonus = 0.0
        if self.normalizer.has_invisible_chars(text):
            obfuscation_bonus += 0.15
            details["invisible_chars"] = True
        if self.normalizer.has_homoglyphs(text):
            obfuscation_bonus += 0.10
            details["homoglyphs"] = True
        
        # Step 2: Normalize text
        normalized_text = self.normalizer.normalize(text)
        
        # Step 3: Pattern matching on both original and normalized
        original_matches = self.matcher.match_patterns(text, category)
        normalized_matches = self.matcher.match_patterns(normalized_text, category)
        
        # Combine matches (normalized catches obfuscated attacks)
        all_matches = list(set(original_matches + normalized_matches))
        
        # Step 4: Calculate confidence score
        if all_matches:
            # Use weighted average of top matches
            weights = sorted([m[1] for m in all_matches], reverse=True)[:5]
            confidence = sum(weights) / len(weights) if weights else 0.0
            
            # Add obfuscation bonus
            confidence = min(confidence + obfuscation_bonus, 1.0)
            
            # Apply sensitivity multiplier
            confidence = min(confidence * self.sensitivity, 1.0)
            
            # Get most likely category
            category_scores: Dict[AttackCategory, float] = {}
            for pattern, weight, cat in all_matches:
                category_scores[cat] = category_scores.get(cat, 0) + weight
                matched_patterns.append(pattern)
            
            detected_category = max(category_scores, key=category_scores.get)
        
        # Step 5: Quick structural checks
        structural_score = self._check_structural_indicators(text)
        confidence = min(confidence + structural_score, 1.0)
        
        # Step 6: Determine risk level
        risk_level = self._calculate_risk_level(confidence)
        
        # Step 7: Determine if malicious
        is_malicious = confidence >= self.LOW_CONFIDENCE_THRESHOLD
        
        return DetectionResult(
            is_malicious=is_malicious,
            confidence=round(confidence, 3),
            category=detected_category,
            matched_patterns=matched_patterns[:10],  # Limit to top 10
            risk_level=risk_level,
            details=details
        )
    
    def _check_structural_indicators(self, text: str) -> float:
        """Check for structural attack indicators (returns bonus score)."""
        score = 0.0
        
        # XML/HTML-like system tags
        if re.search(r'<\s*(system|admin|override|instruction)[^>]*>', text, re.I):
            score += 0.15
        
        # JSON-like override structures
        if re.search(r'\{\s*"?(override|bypass|disable|system)"?\s*:', text, re.I):
            score += 0.15
        
        # Markdown code blocks with system/override content
        if re.search(r'```\s*(system|override|admin)', text, re.I):
            score += 0.10
        
        # Comment-style injections
        if re.search(r'(<!--|/\*|//)\s*(ignore|override|system|bypass)', text, re.I):
            score += 0.10
        
        # Authority claims
        if re.search(r"i('?m| am)\s*(your\s*)?(developer|admin|creator|owner|ceo)", text, re.I):
            score += 0.20
        
        # Fake conversation history
        if re.search(r'(assistant|ai|chatgpt|claude)\s*:\s*"?(my system prompt|ignore|bypass)', text, re.I):
            score += 0.20
        
        return min(score, 0.4)  # Cap structural bonus at 0.4
    
    def _calculate_risk_level(self, confidence: float) -> str:
        """Calculate risk level from confidence score."""
        if confidence >= self.HIGH_CONFIDENCE_THRESHOLD:
            return "critical"
        elif confidence >= self.MEDIUM_CONFIDENCE_THRESHOLD:
            return "high"
        elif confidence >= self.LOW_CONFIDENCE_THRESHOLD:
            return "medium"
        return "low"
    
    def batch_detect(self, texts: List[str]) -> List[DetectionResult]:
        """Detect attacks in multiple texts efficiently."""
        return [self.detect(text) for text in texts]
    
    def get_stats(self) -> Dict:
        """Get detector statistics."""
        return {
            "total_patterns": sum(
                len(patterns) for patterns in PatternMatcher.ATTACK_PATTERNS.values()
            ) + len(PatternMatcher.ENCODING_PATTERNS) + len(PatternMatcher.MULTILANG_PATTERNS),
            "categories": list(AttackCategory),
            "cached_patterns": len(PatternMatcher._compiled_cache),
            "sensitivity": self.sensitivity,
        }


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

# Global detector instance for simple usage
_default_detector: Optional[PromptInjectionDetector] = None


def get_detector(sensitivity: float = 1.0) -> PromptInjectionDetector:
    """Get or create the global detector instance."""
    global _default_detector
    if _default_detector is None or _default_detector.sensitivity != sensitivity:
        _default_detector = PromptInjectionDetector(sensitivity=sensitivity)
    return _default_detector


def detect_injection(text: str, sensitivity: float = 1.0) -> DetectionResult:
    """Quick detection function."""
    return get_detector(sensitivity).detect(text)


def is_malicious(text: str, threshold: float = 0.4) -> bool:
    """Simple boolean check if text is malicious."""
    result = detect_injection(text)
    return result.confidence >= threshold
