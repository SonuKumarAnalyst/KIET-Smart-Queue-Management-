"""
analytics/__init__.py

Public surface of the analytics package.
Import only what external code needs.
"""

from analytics.handler import AnalyticsHandler
from analytics.intent_detector import (
    AnalyticsDetectionResult,
    AnalyticsIntent,
    detect_analytics_intent,
    is_analytics_message,
)
from analytics.queue_analytics import (
    BusyHoursResult,
    QueueAnalytics,
    ServiceTimeResult,
    WaitPredictionResult,
    WaitTimeResult,
)

__all__ = [
    # Handler (main integration point)
    "AnalyticsHandler",
    # Intent detection
    "AnalyticsIntent",
    "AnalyticsDetectionResult",
    "detect_analytics_intent",
    "is_analytics_message",
    # Engine
    "QueueAnalytics",
    # Result types
    "ServiceTimeResult",
    "WaitTimeResult",
    "WaitPredictionResult",
    "BusyHoursResult",
]