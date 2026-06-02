"""SQLite-backed FIFO queue with a single worker thread.

Single worker = printer is the bottleneck. One job prints at a time.
ETA = (position * avg_print_seconds) + remaining_current.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Optional

from . import pipeline, printer


SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  paper_size TEXT NOT NULL,
  paper_preset TEXT NOT NULL,
  copies INTEGER NOT NULL,
  guest_id TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_color TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_at REAL NOT NULL,
  started_at REAL,
  finished_at REAL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, submitted_at);
"""


class JobQueue:
    def __init__(self, db_path: Path, config: dict[str, Any]):
        self.db_path = str(db_path)
        self.config = config
        self.lock = threading.Lock()
        self.recent_durations: deque[float] = deque(maxlen=10)
        self.paused = False
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        c = sqlite3.connect(self.db_path)
        c.row_factory = sqlite3.Row
        return c

    def _init_db(self):
        with self._conn() as c:
            c.executescript(SCHEMA)
            # On startup, reset any "printing" rows back to "queued"
            # in case the agent crashed mid-job.
            c.execute("UPDATE jobs SET status='queued', started_at=NULL WHERE status='printing'")

    # ───── public api ─────

    def depth(self) -> int:
        with self._conn() as c:
            row = c.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','printing')").fetchone()
            return row[0]

    def avg_print_seconds(self) -> float:
        if self.recent_durations:
            return sum(self.recent_durations) / len(self.recent_durations)
        return float(self.config.get("avg_print_seconds_default", 15))

    def jobs_by_guest_since(self, guest_id: str, since_ts: float) -> int:
        with self._conn() as c:
            row = c.execute(
                "SELECT COUNT(*) FROM jobs WHERE guest_id=? AND submitted_at>=?",
                (guest_id, since_ts),
            ).fetchone()
            return row[0]

    def last_submit_for(self, guest_id: str) -> Optional[float]:
        with self._conn() as c:
            row = c.execute(
                "SELECT MAX(submitted_at) FROM jobs WHERE guest_id=?",
                (guest_id,),
            ).fetchone()
            return row[0]

    def enqueue(
        self,
        *,
        job_id: str,
        file_path: str,
        paper_size: str,
        paper_preset: str,
        copies: int,
        guest_id: str,
        guest_name: str,
        guest_color: str,
    ) -> tuple[int, int]:
        now = time.time()
        with self._conn() as c:
            c.execute(
                """INSERT INTO jobs
                (job_id, file_path, paper_size, paper_preset, copies,
                 guest_id, guest_name, guest_color, status, submitted_at)
                VALUES (?,?,?,?,?,?,?,?, 'queued', ?)""",
                (job_id, file_path, paper_size, paper_preset, copies,
                 guest_id, guest_name, guest_color, now),
            )
        position = self._position_of(job_id)
        eta = int(position * self.avg_print_seconds())
        return position, eta

    def _position_of(self, job_id: str) -> int:
        with self._conn() as c:
            row = c.execute(
                """SELECT COUNT(*) FROM jobs
                   WHERE status IN ('queued','printing')
                     AND submitted_at <= (SELECT submitted_at FROM jobs WHERE job_id=?)""",
                (job_id,),
            ).fetchone()
            return row[0]

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as c:
            row = c.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        position = self._position_of(job_id) if d["status"] in ("queued", "printing") else 0
        eta = int(position * self.avg_print_seconds()) if position else 0
        return {
            "status": d["status"],
            "position": position,
            "eta_seconds": eta,
            "guest_color": d["guest_color"],
            "error": d.get("error"),
        }

    def list_recent(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute(
                """SELECT job_id, guest_name, guest_color, status, paper_size, submitted_at, copies
                   FROM jobs ORDER BY submitted_at DESC LIMIT ?""",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def cancel(self, job_id: str) -> bool:
        with self._conn() as c:
            cur = c.execute(
                "UPDATE jobs SET status='failed', error='cancelled' WHERE job_id=? AND status='queued'",
                (job_id,),
            )
            return cur.rowcount > 0

    # ───── worker ─────

    def start_worker(self):
        t = threading.Thread(target=self._worker_loop, daemon=True)
        t.start()

    def _worker_loop(self):
        while True:
            if self.paused:
                time.sleep(1)
                continue
            job = self._claim_next()
            if not job:
                time.sleep(0.5)
                continue
            self._process(job)

    def _claim_next(self) -> Optional[dict[str, Any]]:
        with self.lock, self._conn() as c:
            row = c.execute(
                "SELECT * FROM jobs WHERE status='queued' ORDER BY submitted_at ASC LIMIT 1"
            ).fetchone()
            if not row:
                return None
            c.execute(
                "UPDATE jobs SET status='printing', started_at=? WHERE job_id=?",
                (time.time(), row["job_id"]),
            )
        return dict(row)

    def _process(self, job: dict[str, Any]):
        started = time.time()
        try:
            output = pipeline.run(
                input_path=job["file_path"],
                paper_size=job["paper_size"],
                preset=job["paper_preset"],
                config=self.config,
            )
            printer.print_file(
                output,
                printer_name=self.config["printer_name"],
                paper_size=job["paper_size"],
                copies=job["copies"],
                timeout_s=self.config.get("print_timeout_seconds", 60),
            )
            with self._conn() as c:
                c.execute(
                    "UPDATE jobs SET status='done', finished_at=? WHERE job_id=?",
                    (time.time(), job["job_id"]),
                )
            self.recent_durations.append(time.time() - started)
        except Exception as e:  # noqa: BLE001
            with self._conn() as c:
                c.execute(
                    "UPDATE jobs SET status='failed', finished_at=?, error=? WHERE job_id=?",
                    (time.time(), str(e), job["job_id"]),
                )
