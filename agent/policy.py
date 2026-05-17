"""Fair-use guardrails for the print queue.

Returns either None (allowed) or an error dict with `error` + optional
`retry_after`, ready to drop straight into a 429 JSON response.
"""
from __future__ import annotations

import time
from typing import Any, Optional


def check(queue, guest_id: str, config: dict[str, Any]) -> Optional[dict[str, Any]]:
    # Max queue depth
    if queue.depth() >= config.get("max_queue_depth", 20):
        return {"error": "queue_full", "retry_after": 120}

    # Per-guest cooldown
    cooldown = config.get("cooldown_seconds", 60)
    last = queue.last_submit_for(guest_id)
    if last is not None:
        elapsed = time.time() - last
        if elapsed < cooldown:
            return {"error": "cooldown", "retry_after": int(cooldown - elapsed)}

    # Per-guest event quota (24h rolling)
    quota = config.get("per_guest_quota", 5)
    used = queue.jobs_by_guest_since(guest_id, time.time() - 24 * 3600)
    if used >= quota:
        return {"error": "quota_exceeded", "retry_after": 3600}

    return None
