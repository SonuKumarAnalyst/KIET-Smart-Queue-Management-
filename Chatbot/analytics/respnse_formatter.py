"""
analytics/response_formatter.py

Converts analytics result objects into friendly natural-language strings.

Changes from v1
---------------
* Removed "take this with a grain of salt" — replaced with a gentle note
* All low-data warnings are now polite and informative
* No mocking or condescending tone anywhere
"""

from __future__ import annotations

from analytics.queue_analytics import (
    BusyHoursResult,
    ServiceTimeResult,
    WaitPredictionResult,
    WaitTimeResult,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mins(minutes: float) -> str:
    if minutes < 1:
        return "less than a minute"
    if minutes < 60:
        m = round(minutes)
        return f"{m} minute{'s' if m != 1 else ''}"
    h = int(minutes // 60)
    m = round(minutes % 60)
    parts = [f"{h} hour{'s' if h != 1 else ''}"]
    if m:
        parts.append(f"{m} minute{'s' if m != 1 else ''}")
    return " and ".join(parts)


def _sample_note(sample_size: int) -> str:
    """Return a gentle note when data is limited — never rude."""
    if sample_size == 0:
        return ""          # handled separately
    if sample_size < 5:
        return f" (early estimate — only {sample_size} completed ticket{'s' if sample_size != 1 else ''} on record so far)"
    if sample_size < 10:
        return f" (based on {sample_size} tickets — figures will improve as more data is collected)"
    return f" (based on {sample_size:,} completed tickets)"


# ---------------------------------------------------------------------------
# 1. Service time
# ---------------------------------------------------------------------------

def format_service_time(result: ServiceTimeResult, dept_name: str = "") -> str:
    label = dept_name or f"department `{result.department_id}`"

    if result.sample_size == 0:
        return (
            f"I don't have service-time data for **{label}** yet — "
            f"this figure becomes available once tickets start completing. "
            f"Check back soon!"
        )

    note = _sample_note(result.sample_size)
    return (
        f"On average, serving one person at **{label}** takes about "
        f"**{_mins(result.average_service_minutes)}**{note}."
    )


# ---------------------------------------------------------------------------
# 2. Wait time
# ---------------------------------------------------------------------------

def format_wait_time(result: WaitTimeResult, dept_name: str = "") -> str:
    label = dept_name or f"department `{result.department_id}`"

    if result.sample_size == 0:
        return (
            f"Wait-time data for **{label}** isn't available yet. "
            f"It will appear here once a few tickets have been completed."
        )

    note = _sample_note(result.sample_size)
    return (
        f"On average, students wait about **{_mins(result.average_wait_minutes)}** "
        f"before being called at **{label}**{note}."
    )


# ---------------------------------------------------------------------------
# 3. Current wait prediction
# ---------------------------------------------------------------------------

def format_wait_prediction(result: WaitPredictionResult, dept_name: str = "") -> str:
    label = dept_name or f"department `{result.department_id}`"

    if not result.queue_is_open:
        return (
            f"The **{label}** queue is currently **closed** 🔒. "
            f"Please check back during office hours."
        )

    if result.queue_is_paused:
        t = result.waiting_tickets
        return (
            f"The **{label}** queue is currently **paused** ⏸️. "
            f"There {'is' if t == 1 else 'are'} **{t}** ticket{'s' if t != 1 else ''} "
            f"ahead if you join now."
        )

    if result.waiting_tickets == 0:
        return (
            f"🟢 The **{label}** queue is **empty right now** — "
            f"you'd be served almost immediately. Great time to go!"
        )

    wait_str = _mins(result.predicted_wait_minutes)
    t = result.waiting_tickets
    rec = result.recommendation

    if rec == "join_now":
        emoji, advice = "🟢", "That's a short wait — good time to head over!"
    elif rec == "acceptable":
        emoji, advice = "🟡", "Moderate wait. You can join now or try a quieter hour."
    else:
        emoji, advice = "🔴", "The queue is quite long right now. Consider visiting during a quieter hour."

    return (
        f"{emoji} **{label}** has **{t} ticket{'s' if t != 1 else ''}** waiting. "
        f"Estimated wait: **{wait_str}**. {advice}"
    )


# ---------------------------------------------------------------------------
# 4. Busy hours
# ---------------------------------------------------------------------------

def format_busy_hours(result: BusyHoursResult, dept_name: str = "") -> str:
    label = dept_name or f"department `{result.department_id}`"

    if result.sample_size == 0:
        return (
            f"Traffic data for **{label}** isn't available yet. "
            f"Busy-hour patterns will appear here once more tickets have been processed."
        )

    note = _sample_note(result.sample_size)

    quiet_line = ""
    if result.least_busy:
        quiet_labels = ", ".join(s.label for s in result.least_busy)
        quiet_line = f"🟢 **Least crowded:** {quiet_labels}"

    peak_line = ""
    if result.busiest:
        peak_labels = ", ".join(s.label for s in result.busiest)
        peak_line = f"🔴 **Busiest hours:** {peak_labels}"

    lines = [
        f"Here's the traffic pattern for **{label}**{note}:",
        "",
        quiet_line,
        peak_line,
        "",
        "💡 Visiting during the least-crowded hours usually means the shortest wait.",
    ]
    return "\n".join(line for line in lines if line is not None)


# ---------------------------------------------------------------------------
# Fallbacks
# ---------------------------------------------------------------------------

def format_no_department_found(name: str) -> str:
    return (
        f"I couldn't find a department called **\"{name}\"**. "
        f"Could you double-check the name?"
    )


def format_analytics_error(detail: str = "") -> str:
    msg = "Something went wrong while fetching that data."
    if detail:
        msg += f" ({detail})"
    msg += " Please try again in a moment."
    return msg