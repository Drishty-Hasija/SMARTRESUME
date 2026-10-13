"""Lazy loading of NLP models/corpora (NLTK data, spaCy model).

Loading is done once per process and cached. Missing NLTK corpora are
downloaded automatically on first use.
"""
import logging
from functools import lru_cache

import nltk

logger = logging.getLogger(__name__)

_NLTK_RESOURCES = {
    "stopwords": "corpora/stopwords",
    "wordnet": "corpora/wordnet",
    "omw-1.4": "corpora/omw-1.4",
    "punkt_tab": "tokenizers/punkt_tab",
    "averaged_perceptron_tagger_eng": "taggers/averaged_perceptron_tagger_eng",
}


@lru_cache(maxsize=1)
def ensure_nltk() -> None:
    for name, path in _NLTK_RESOURCES.items():
        try:
            nltk.data.find(path)
        except LookupError:
            logger.info("Downloading NLTK resource %s", name)
            try:
                nltk.download(name, quiet=True)
            except Exception:  # pragma: no cover - offline
                logger.warning("Could not download NLTK resource %s", name)


@lru_cache(maxsize=1)
def get_spacy():
    """Return the spaCy small English model, or None if it is not installed."""
    try:
        import spacy

        return spacy.load(
            "en_core_web_sm", disable=["tagger", "parser", "attribute_ruler", "lemmatizer"]
        )
    except Exception:  # model missing / spaCy broken
        logger.warning("spaCy model 'en_core_web_sm' unavailable; NER disabled. "
                       "Run: python -m spacy download en_core_web_sm")
        return None


def warm_up() -> None:
    """Load everything once at startup so the first request is fast."""
    ensure_nltk()
    get_spacy()
