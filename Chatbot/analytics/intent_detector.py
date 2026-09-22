"""
analytics/intent_detector.py

Lightweight rule-based intent detector.

Fixes applied
-------------
* Department hint extraction now works for lowercase names (e.g. "cse")
* Intent keywords are stripped from the text before searching for a dept name
  so "least crowded" is never mistaken for a department name
* Preposition-based fallback ("for cse", "at cse", "of cse") works reliably
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum, auto
from typing import Optional


class AnalyticsIntent(Enum):
    LEAST_BUSY_HOUR      = auto()
    SHOULD_JOIN_NOW      = auto()
    CURRENT_WAIT         = auto()
    AVERAGE_WAIT_TIME    = auto()
    AVERAGE_SERVICE_TIME = auto()


@dataclass
class AnalyticsDetectionResult:
    intent: AnalyticsIntent
    department_hint: Optional[str]


# ---------------------------------------------------------------------------
# Intent patterns
# ---------------------------------------------------------------------------

_LEAST_BUSY_PATTERNS: list[str] = [
    r"least\s+(?:busy|crowded|congested)",
    r"best\s+time\s+(?:to\s+)?(?:go|visit|come|join)",
    r"quiet(?:est)?\s+(?:hour|time|period)",
    r"when\s+(?:is|are).+(?:not\s+busy|empty|free|less\s+crowd)",
    r"off.?peak",
    r"avoid\s+(?:the\s+)?crowd",
    r"less\s+(?:busy|crowded|congested)",
]

_SHOULD_JOIN_PATTERNS: list[str] = [
    r"should\s+i\s+(?:go|join|visit|head)",
    r"(?:is\s+it|is\s+now)\s+(?:a\s+)?good\s+time",
    r"worth\s+(?:going|joining|visiting)",
    r"recommend\s+(?:going|joining|visiting)",
    r"shall\s+i\s+(?:go|join)",
    r"good\s+time\s+to\s+(?:go|visit|join)",
]

_CURRENT_WAIT_PATTERNS: list[str] = [
    r"how\s+long\s+(?:will\s+i\s+wait|is\s+the\s+wait|do\s+i\s+have\s+to\s+wait)",
    r"(?:current|right\s+now|today)\s+wait",
    r"wait\s+time\s+(?:right\s+now|currently|today|now)",
    r"how\s+many\s+(?:people|tickets)\s+(?:are\s+)?(?:ahead|waiting)",
    r"queue\s+length",
    r"how\s+busy\s+is",
]

_AVG_WAIT_PATTERNS: list[str] = [
    r"average\s+wait",
    r"avg\s+wait",
    r"typical\s+wait",
    r"usual(?:ly)?\s+(?:wait|take)",
    r"how\s+long\s+(?:does\s+it\s+usually|do\s+people\s+usually)\s+wait",
    r"mean\s+wait",
    r"wait\s+time\s+(?:of|for|at)",
]

_AVG_SERVICE_PATTERNS: list[str] = [
    r"average\s+service",
    r"how\s+long\s+does\s+.+\s+(?:take|usually\s+take)",
    r"how\s+long\s+do\s+they\s+take",
    r"service\s+time",
    r"how\s+fast\s+(?:is|are|does)",
    r"processing\s+time",
]

_INTENT_PATTERN_MAP: list[tuple[AnalyticsIntent, list[str]]] = [
    (AnalyticsIntent.LEAST_BUSY_HOUR,      _LEAST_BUSY_PATTERNS),
    (AnalyticsIntent.SHOULD_JOIN_NOW,      _SHOULD_JOIN_PATTERNS),
    (AnalyticsIntent.CURRENT_WAIT,         _CURRENT_WAIT_PATTERNS),
    (AnalyticsIntent.AVERAGE_WAIT_TIME,    _AVG_WAIT_PATTERNS),
    (AnalyticsIntent.AVERAGE_SERVICE_TIME, _AVG_SERVICE_PATTERNS),
]

_COMPILED: list[tuple[AnalyticsIntent, list[re.Pattern]]] = [
    (intent, [re.compile(p, re.IGNORECASE) for p in patterns])
    for intent, patterns in _INTENT_PATTERN_MAP
]

# ---------------------------------------------------------------------------
# Intent keyword scrubber
# ---------------------------------------------------------------------------

_INTENT_SCRUB = re.compile(
    r"""
      least\s+(?:busy|crowded|congested)
    | best\s+time(?:\s+to\s+(?:go|visit|come|join))?
    | quiet(?:est)?\s+(?:hour|time|period)
    | off.?peak
    | avoid\s+(?:the\s+)?crowd
    | less\s+(?:busy|crowded|congested)
    | should\s+i\s+(?:go|join|visit|head)
    | good\s+time(?:\s+to\s+(?:go|visit|join))?
    | average\s+(?:wait|service)\s*(?:time)?
    | avg\s+wait
    | wait\s+time
    | service\s+time
    | how\s+long\s+(?:will\s+i\s+wait|is\s+the\s+wait|does?\s+it\s+(?:usually\s+)?take)
    | how\s+(?:fast|busy)
    | how\s+many\s+(?:people|tickets)
    | queue\s+length
    | typical\s+wait
    | mean\s+wait
    | processing\s+time
    | when\s+is\b
    | when\s+are\b
    | what\s+is\b
    | what\s+are\b
    | is\s+it\b
    | is\s+now\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

# ---------------------------------------------------------------------------
# Stopwords — words that are never department names
# ---------------------------------------------------------------------------

_GLOBAL_STOPWORDS: set[str] = {
    "when", "what", "how", "where", "why", "who", "which",
    "is", "are", "was", "were", "will", "can", "does", "do", "did",
    "should", "shall", "would", "could", "might", "must", "have", "has",
    "i", "we", "they", "he", "she", "it", "my", "your", "their",
    "the", "a", "an", "at", "in", "of", "to", "for", "on", "by",
    "with", "from", "about", "into", "after", "before",
    "now", "today", "currently", "usually", "often", "please",
    "tell", "me", "give", "show", "find", "get", "check",
    "crowded", "busy", "long", "time", "wait", "join", "go", "visit",
    "least", "best", "good", "right", "and", "or", "not",
}

_DEPT_PREPOSITIONS = re.compile(
    r"(?:for|at|in|of|to|about)\s+",
    re.IGNORECASE,
)

_TRAILING_NOISE = re.compile(
    r"\b(department|dept\.?|office|queue|the|is|now|today)\b",
    re.IGNORECASE,
)


def _extract_department_hint(original_text: str) -> Optional[str]:
    """
    Extract a department name from the query.

    Strategy (in order)
    -------------------
    1. Scrub intent-bearing phrases so "least crowded" is never returned.
    2. Look for the first meaningful word after a preposition
       ("for cse", "at admin", "of accounts").
    3. Scan all remaining words — picks up bare "cse" or "CSE".
    """
    # Step 1: remove intent keywords
    scrubbed = _INTENT_SCRUB.sub(" ", original_text)
    scrubbed = re.sub(r"\s{2,}", " ", scrubbed).strip()

    # Step 2: word(s) after preposition
    m = _DEPT_PREPOSITIONS.search(scrubbed)
    if m:
        after_words = scrubbed[m.end():].split()
        candidate_words = []
        for w in after_words:
            clean = _TRAILING_NOISE.sub("", w).strip(" ?,.")
            if clean and clean.lower() not in _GLOBAL_STOPWORDS and len(clean) >= 2:
                candidate_words.append(clean)
            else:
                break
        if candidate_words:
            return " ".join(candidate_words)

    # Step 3: any non-stopword remaining token
    words = scrubbed.split()
    candidates = []
    for w in words:
        clean = _TRAILING_NOISE.sub("", w).strip(" ?,.")
        if clean and clean.lower() not in _GLOBAL_STOPWORDS and len(clean) >= 2:
            candidates.append(clean)

    if candidates:
        candidates.sort(key=len, reverse=True)
        return candidates[0]

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_analytics_intent(message: str) -> Optional[AnalyticsDetectionResult]:
    for intent, patterns in _COMPILED:
        for pattern in patterns:
            if pattern.search(message):
                dept_hint = _extract_department_hint(message)
                return AnalyticsDetectionResult(
                    intent=intent,
                    department_hint=dept_hint,
                )
    return None


def is_analytics_message(message: str) -> bool:
    return detect_analytics_intent(message) is not None