"""
analytics/queue_analytics.py

Queue Analytics and Prediction Engine
Campus Queue Management System

Provides historical analysis and real-time wait predictions using
MongoDB aggregation pipelines via Motor (async).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclasses  (typed, serialisable)
# ---------------------------------------------------------------------------

@dataclass
class ServiceTimeResult:
    department_id: str
    average_service_seconds: float
    average_service_minutes: float
    sample_size: int
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_reliable(self) -> bool:
        """Flag low-sample results so callers can warn users."""
        return self.sample_size >= 10


@dataclass
class WaitTimeResult:
    department_id: str
    average_wait_seconds: float
    average_wait_minutes: float
    sample_size: int
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_reliable(self) -> bool:
        return self.sample_size >= 10


@dataclass
class WaitPredictionResult:
    department_id: str
    waiting_tickets: int
    average_service_minutes: float
    predicted_wait_minutes: float
    queue_is_open: bool
    queue_is_paused: bool
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def recommendation(self) -> str:
        if not self.queue_is_open:
            return "closed"
        if self.queue_is_paused:
            return "paused"
        if self.predicted_wait_minutes <= 10:
            return "join_now"
        if self.predicted_wait_minutes <= 30:
            return "acceptable"
        return "long_wait"


@dataclass
class BusyHourSlot:
    hour: int           # 0-23
    ticket_count: int

    @property
    def label(self) -> str:
        """Human-readable hour label, e.g. '9 AM', '2 PM'."""
        suffix = "AM" if self.hour < 12 else "PM"
        display = self.hour if self.hour <= 12 else self.hour - 12
        display = 12 if display == 0 else display
        return f"{display} {suffix}"


@dataclass
class BusyHoursResult:
    department_id: str
    least_busy: list[BusyHourSlot]   # up to 3 quietest hours
    busiest: list[BusyHourSlot]       # up to 3 busiest hours
    all_hours: list[BusyHourSlot]     # full 24-slot profile
    sample_size: int
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def is_reliable(self) -> bool:
        return self.sample_size >= 20


# ---------------------------------------------------------------------------
# Analytics engine
# ---------------------------------------------------------------------------

class QueueAnalytics:
    """
    Async analytics engine backed by MongoDB aggregation pipelines.

    Usage
    -----
    analytics = QueueAnalytics(db)
    result = await analytics.get_average_service_time("dept_object_id_string")
    """

    # How many days of history to consider for averages
    HISTORY_DAYS: int = 30

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _to_object_id(self, value: str) -> ObjectId:
        try:
            return ObjectId(value)
        except Exception:
            raise ValueError(f"Invalid ObjectId: {value!r}")

    async def _resolve_department_id(self, department_id: str) -> ObjectId:
        """Accept either a raw ObjectId string or a department name."""
        # Try direct ObjectId first
        if ObjectId.is_valid(department_id):
            return ObjectId(department_id)

        # Fall back to name lookup (case-insensitive)
        dept = await self._db.departments.find_one(
            {"name": {"$regex": f"^{department_id}$", "$options": "i"}}
        )
        if not dept:
            raise ValueError(f"Department not found: {department_id!r}")
        return dept["_id"]

    async def _get_queue_id_for_department(self, dept_oid: ObjectId) -> Optional[ObjectId]:
        queue = await self._db.queues.find_one({"department": dept_oid})
        return queue["_id"] if queue else None

    async def _get_queue_status(self, dept_oid: ObjectId) -> tuple[bool, bool]:
        """Returns (isOpen, isPaused) for the department's queue."""
        queue = await self._db.queues.find_one({"department": dept_oid})
        if not queue:
            return False, False
        return bool(queue.get("isOpen", False)), bool(queue.get("isPaused", False))

    def _history_match_stage(self, queue_oid: ObjectId) -> dict:
        """
        Common $match stage: completed tickets in this queue
        within the configured history window.
        """
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.HISTORY_DAYS)
        return {
            "$match": {
                "queue": queue_oid,
                "status": "completed",
                "createdAt": {"$gte": cutoff},
                "calledAt": {"$exists": True, "$ne": None},
                "servedAt": {"$exists": True, "$ne": None},
            }
        }

    # ------------------------------------------------------------------
    # 1. Average service time  (servedAt − calledAt)
    # ------------------------------------------------------------------

    async def get_average_service_time(self, department_id: str) -> ServiceTimeResult:
        """
        Compute mean time a staff member spends serving one ticket.

        Pipeline
        --------
        match completed tickets → project duration → group → project result
        """
        dept_oid = await self._resolve_department_id(department_id)
        queue_oid = await self._get_queue_id_for_department(dept_oid)

        if queue_oid is None:
            logger.warning("No queue found for department %s", department_id)
            return ServiceTimeResult(
                department_id=str(dept_oid),
                average_service_seconds=0,
                average_service_minutes=0,
                sample_size=0,
            )

        pipeline = [
            self._history_match_stage(queue_oid),
            {
                "$project": {
                    "service_seconds": {
                        "$divide": [
                            {"$subtract": ["$servedAt", "$calledAt"]},
                            1000,   # ms → seconds
                        ]
                    }
                }
            },
            # Exclude negative/zero durations (data anomalies)
            {"$match": {"service_seconds": {"$gt": 0}}},
            {
                "$group": {
                    "_id": None,
                    "avg_service_seconds": {"$avg": "$service_seconds"},
                    "count": {"$sum": 1},
                }
            },
        ]

        cursor = self._db.tickets.aggregate(pipeline)
        results = await cursor.to_list(length=1)

        if not results:
            return ServiceTimeResult(
                department_id=str(dept_oid),
                average_service_seconds=0,
                average_service_minutes=0,
                sample_size=0,
            )

        row = results[0]
        avg_sec = float(row["avg_service_seconds"])
        return ServiceTimeResult(
            department_id=str(dept_oid),
            average_service_seconds=round(avg_sec, 2),
            average_service_minutes=round(avg_sec / 60, 2),
            sample_size=int(row["count"]),
        )

    # ------------------------------------------------------------------
    # 2. Average wait time  (calledAt − createdAt)
    # ------------------------------------------------------------------

    async def get_average_wait_time(self, department_id: str) -> WaitTimeResult:
        """
        Compute mean time a student waits from joining to being called.

        Pipeline
        --------
        match completed tickets → project wait duration → group → result
        """
        dept_oid = await self._resolve_department_id(department_id)
        queue_oid = await self._get_queue_id_for_department(dept_oid)

        if queue_oid is None:
            return WaitTimeResult(
                department_id=str(dept_oid),
                average_wait_seconds=0,
                average_wait_minutes=0,
                sample_size=0,
            )

        pipeline = [
            self._history_match_stage(queue_oid),
            {
                "$project": {
                    "wait_seconds": {
                        "$divide": [
                            {"$subtract": ["$calledAt", "$createdAt"]},
                            1000,
                        ]
                    }
                }
            },
            {"$match": {"wait_seconds": {"$gt": 0}}},
            {
                "$group": {
                    "_id": None,
                    "avg_wait_seconds": {"$avg": "$wait_seconds"},
                    "count": {"$sum": 1},
                }
            },
        ]

        cursor = self._db.tickets.aggregate(pipeline)
        results = await cursor.to_list(length=1)

        if not results:
            return WaitTimeResult(
                department_id=str(dept_oid),
                average_wait_seconds=0,
                average_wait_minutes=0,
                sample_size=0,
            )

        row = results[0]
        avg_sec = float(row["avg_wait_seconds"])
        return WaitTimeResult(
            department_id=str(dept_oid),
            average_wait_seconds=round(avg_sec, 2),
            average_wait_minutes=round(avg_sec / 60, 2),
            sample_size=int(row["count"]),
        )

    # ------------------------------------------------------------------
    # 3. Current wait prediction  (waiting tickets × avg service time)
    # ------------------------------------------------------------------

    async def get_current_wait_prediction(self, department_id: str) -> WaitPredictionResult:
        """
        Estimate how long a new arrival would wait right now.

        Formula
        -------
        predicted_wait = waiting_ticket_count × avg_service_time_per_ticket
        """
        dept_oid = await self._resolve_department_id(department_id)
        queue_oid = await self._get_queue_id_for_department(dept_oid)
        is_open, is_paused = await self._get_queue_status(dept_oid)

        # Count currently waiting tickets
        waiting_count = 0
        if queue_oid:
            waiting_count = await self._db.tickets.count_documents(
                {"queue": queue_oid, "status": "waiting"}
            )

        # Get historical average service time
        svc = await self.get_average_service_time(department_id)
        avg_svc_min = svc.average_service_minutes or 5.0  # fallback: 5 min

        predicted_wait = round(waiting_count * avg_svc_min, 1)

        return WaitPredictionResult(
            department_id=str(dept_oid),
            waiting_tickets=waiting_count,
            average_service_minutes=avg_svc_min,
            predicted_wait_minutes=predicted_wait,
            queue_is_open=is_open,
            queue_is_paused=is_paused,
        )

    # ------------------------------------------------------------------
    # 4. Least busy hours  (group tickets by hour(createdAt))
    # ------------------------------------------------------------------

    async def get_least_busy_hours(self, department_id: str) -> BusyHoursResult:
        """
        Analyse historical ticket creation times to find quiet and peak hours.

        Pipeline
        --------
        match all tickets (not just completed) → extract hour →
        group by hour → sort → split into least/busiest
        """
        from datetime import timedelta

        dept_oid = await self._resolve_department_id(department_id)
        queue_oid = await self._get_queue_id_for_department(dept_oid)

        if queue_oid is None:
            return BusyHoursResult(
                department_id=str(dept_oid),
                least_busy=[],
                busiest=[],
                all_hours=[],
                sample_size=0,
            )

        cutoff = datetime.now(timezone.utc) - timedelta(days=self.HISTORY_DAYS)

        pipeline = [
            {
                "$match": {
                    "queue": queue_oid,
                    "createdAt": {"$gte": cutoff},
                }
            },
            # Extract hour-of-day in UTC (adjust $subtract offset if campus
            # is in a different timezone, e.g. +5:30 → 19800 seconds)
            {
                "$project": {
                    "hour": {"$hour": "$createdAt"},
                }
            },
            {
                "$group": {
                    "_id": "$hour",
                    "ticket_count": {"$sum": 1},
                }
            },
            {"$sort": {"ticket_count": 1}},   # ascending → least busy first
        ]

        cursor = self._db.tickets.aggregate(pipeline)
        raw = await cursor.to_list(length=24)

        if not raw:
            return BusyHoursResult(
                department_id=str(dept_oid),
                least_busy=[],
                busiest=[],
                all_hours=[],
                sample_size=0,
            )

        all_hours = [BusyHourSlot(hour=r["_id"], ticket_count=r["ticket_count"]) for r in raw]
        total_tickets = sum(s.ticket_count for s in all_hours)

        # Least busy = first 3 after ascending sort
        least_busy = all_hours[:3]
        # Busiest = last 3 (most tickets)
        busiest = sorted(all_hours, key=lambda s: s.ticket_count, reverse=True)[:3]

        return BusyHoursResult(
            department_id=str(dept_oid),
            least_busy=least_busy,
            busiest=busiest,
            all_hours=all_hours,
            sample_size=total_tickets,
        )