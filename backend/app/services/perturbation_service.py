import base64
import codecs
import random
import re

class PerturbationService:
    """
    Service for applying various transformations (perturbations) to prompts
    to test the robustness of LLM security filters.
    """

    @staticmethod
    def apply_base64(text: str) -> str:
        """Encodes text to Base64."""
        return base64.b64encode(text.encode()).decode()

    @staticmethod
    def apply_rot13(text: str) -> str:
        """Applies ROT13 encoding to text."""
        return codecs.encode(text, 'rot_13')

    @staticmethod
    def apply_leetspeak(text: str) -> str:
        """Replaces characters with leetspeak equivalents."""
        replacements = {
            'a': '4', 'A': '4',
            'e': '3', 'E': '3',
            'i': '1', 'I': '1',
            'o': '0', 'O': '0',
            's': '$', 'S': '5',
            't': '7', 'T': '7',
            'b': '8', 'B': '8',
            'g': '9', 'G': '9'
        }
        return "".join(replacements.get(c, c) for c in text)

    @staticmethod
    def apply_unicode_homoglyphs(text: str) -> str:
        """Replaces Latin characters with similar-looking Unicode characters (homoglyphs)."""
        homoglyphs = {
            'a': 'а', 'A': 'А',  # Cyrillic
            'e': 'е', 'E': 'Е',
            'o': 'о', 'O': 'О',
            'p': 'р', 'P': 'Р',
            'c': 'с', 'C': 'С',
            'y': 'у', 'Y': 'У',
            'x': 'х', 'X': 'Х',
            'i': 'і', 'I': 'І'
        }
        return "".join(homoglyphs.get(c, c) for c in text)

    @staticmethod
    def apply_invisible_chars(text: str) -> str:
        """Inserts zero-width spaces (U+200B) between characters."""
        return "\u200b".join(list(text))

    @staticmethod
    def apply_random_casing(text: str) -> str:
        """Randomly upper/lower cases characters."""
        return "".join(c.upper() if random.random() > 0.5 else c.lower() for c in text)

    def perturb(self, text: str, perturbation_type: str) -> str:
        """Applies the specified perturbation to the text."""
        dispatch = {
            "base64": self.apply_base64,
            "rot13": self.apply_rot13,
            "leetspeak": self.apply_leetspeak,
            "unicode": self.apply_unicode_homoglyphs,
            "invisible": self.apply_invisible_chars,
            "random_case": self.apply_random_casing
        }
        
        func = dispatch.get(perturbation_type.lower())
        if func:
            return func(text)
        return text

# Singleton instance
perturbation_service = PerturbationService()

def get_perturbation_service():
    return perturbation_service
