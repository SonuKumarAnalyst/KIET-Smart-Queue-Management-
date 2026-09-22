"""
analytics/handler.py

AnalyticsHandler — integration point between the chatbot router
and the analytics engine.

Changes from v1
---------------
* handle() now accepts an optional `dept_hint_override` so the chatbot
  can pass the last-mentioned department for follow-up questions like:
    user: "average wait time"
    user: "cse"              ← follow-up; main.py passes "cse" as override
* _find_department() tries both exact and partial (regex) matches so
  "cse" reliably resolves to a department named "CSE".
* _no_dept_response() no longer shows a scary "I couldn't find" message
  for follow-ups — it asks politely instead.
"""

from __future__ import annotations

import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from analytics.intent_detector import AnalyticsIntent, detect_analytics_intent
from analytics.queue_analytics import QueueAnalytics
from analytics.respnse_formatter import (
    format_analytics_error,
    format_busy_hours,
    format_no_department_found,
    format_service_time,
    format_wait_prediction,
    format_wait_time,
)

logger = logging.getLogger(__name__)


class AnalyticsHandler:

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._analytics = QueueAnalytics(db)
        self._db = db

    # ------------------------------------------------------------------
    # Department lookup
    # ------------------------------------------------------------------

    async def _find_department(self, hint: Optional[str]) -> Optional[dict]:
        """
        Case-insensitive lookup. Tries:
        1. Exact name match  (handles "CSE" == "cse")
        2. Name contains hint (handles "Admin" matching "Admin Office")
        """
        if not hint:
            return None

        # Exact case-insensitive match first
        dept = await self._db.departments.find_one(
            {"name": {"$regex": f"^{re.escape(hint)}$", "$options": "i"},
             "isActive": True}
        )
        if dept:
            return dept

        # Partial match (hint appears anywhere in the name)
        dept = await self._db.departments.find_one(
            {"name": {"$regex": re.escape(hint), "$options": "i"},
             "isActive": True}
        )
        return dept

    async def _list_active_department_names(self) -> list[str]:
        cursor = self._db.departments.find({"isActive": True}, {"name": 1})
        docs = await cursor.to_list(length=50)
        return [d["name"] for d in docs]

    def _ask_for_department(self, active_names: list[str]) -> str:
        names_str = ", ".join(active_names) if active_names else "none found"
        return (
            f"Which department would you like analytics for? "
            f"Available departments: **{names_str}**."
        )

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    async def handle(
        self,
        message: str,
        dept_hint_override: Optional[str] = None,
    ) -> Optional[str]:
        """
        Handle an analytics query.

        Parameters
        ----------
        message : str
            The user's raw message.
        dept_hint_override : str, optional
            Department name from conversation context (e.g. last dept the
            user mentioned). Used when the current message has no dept hint.
        """
        detection = detect_analytics_intent(message)
        if detection is None:
            return None

        intent = detection.intent

        # Resolve department — current message takes priority, then override
        hint = detection.department_hint or dept_hint_override
        dept = await self._find_department(hint)

        if dept is None:
            active_names = await self._list_active_department_names()
            return self._ask_for_department(active_names)

        dept_id   = str(dept["_id"])
        dept_name = dept["name"]

        try:
            return await self._dispatch(intent, dept_id, dept_name)
        except ValueError as exc:
            logger.warning("Analytics ValueError: %s", exc)
            return format_analytics_error(str(exc))
        except Exception:
            logger.exception("Unexpected analytics error for intent %s", intent)
            return format_analytics_error()

    # ------------------------------------------------------------------
    # Intent dispatcher
    # ------------------------------------------------------------------

    async def _dispatch(self, intent: AnalyticsIntent, dept_id: str, dept_name: str) -> str:
        if intent == AnalyticsIntent.LEAST_BUSY_HOUR:
            result = await self._analytics.get_least_busy_hours(dept_id)
            return format_busy_hours(result, dept_name)

        if intent in (AnalyticsIntent.SHOULD_JOIN_NOW, AnalyticsIntent.CURRENT_WAIT):
            result = await self._analytics.get_current_wait_prediction(dept_id)
            return format_wait_prediction(result, dept_name)

        if intent == AnalyticsIntent.AVERAGE_WAIT_TIME:
            result = await self._analytics.get_average_wait_time(dept_id)
            return format_wait_time(result, dept_name)

        if intent == AnalyticsIntent.AVERAGE_SERVICE_TIME:
            result = await self._analytics.get_average_service_time(dept_id)
            return format_service_time(result, dept_name)

        return format_analytics_error("Unrecognised analytics intent.")


# re needed for _find_department — import at module level
import re