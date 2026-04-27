"""
Pending MFA setup (secret + recovery codes) keyed by setup_id.

Primary store: MongoDB collection `mfa_setup_pending` (survives Uvicorn --reload and multiple workers).
Fallback: in-process dict if Mongo is unavailable.
"""
from __future__ import annotations

import logging
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

COLLECTION = "mfa_setup_pending"
TTL_SEC = 900  # 15 minutes

_lock = threading.Lock()
_store: Dict[str, Dict[str, Any]] = {}


def _mem_prune() -> None:
    now = time.time()
    with _lock:
        for k in [k for k, v in _store.items() if v["exp"] < now]:
            del _store[k]


async def create_setup_session(email: str, secret: str, recovery_codes: List[str]) -> str:
    """Register a new MFA setup; returns setup_id for the client."""
    sid = secrets.token_urlsafe(32)
    em = email.strip().lower()
    exp = datetime.now(timezone.utc) + timedelta(seconds=TTL_SEC)
    doc = {
        "setup_id": sid,
        "email": em,
        "secret": secret,
        "recovery_codes": list(recovery_codes),
        "expires_at": exp,
    }
    try:
        from app.core.database import mongodb

        if mongodb.database is not None:
            await mongodb.database[COLLECTION].insert_one(doc)
            logger.info(
                "MFA pending CREATE backend=mongo setup_id=%s... email=%s secret_len=%d recovery_n=%d",
                sid[:14],
                em,
                len(secret or ""),
                len(recovery_codes),
            )
            return sid
    except Exception as e:
        logger.warning("MFA pending: Mongo insert failed, using memory: %s", e)

    with _lock:
        _mem_prune()
        _store[sid] = {
            "email": em,
            "secret": secret,
            "recovery_codes": list(recovery_codes),
            "exp": time.time() + TTL_SEC,
        }
    logger.info(
        "MFA pending CREATE backend=memory setup_id=%s... email=%s secret_len=%d recovery_n=%d",
        sid[:14],
        em,
        len(secret or ""),
        len(recovery_codes),
    )
    return sid


async def peek_setup_session(setup_id: str, email: str) -> Optional[Dict[str, Any]]:
    """Return secret + recovery_codes if setup_id is valid for this email (does not consume)."""
    if not setup_id:
        return None
    em = email.strip().lower()
    try:
        from app.core.database import mongodb

        if mongodb.database is None:
            logger.info("MFA pending PEEK: MongoDB not initialized (using in-memory store only)")
        else:
            coll = mongodb.database[COLLECTION]
            doc = await coll.find_one(
                {
                    "setup_id": setup_id,
                    "email": em,
                    "expires_at": {"$gt": datetime.now(timezone.utc)},
                }
            )
            if doc:
                logger.info(
                    "MFA pending PEEK HIT backend=mongo setup_id=%s... email=%s",
                    setup_id[:14],
                    em,
                )
                return {
                    "secret": doc["secret"],
                    "recovery_codes": list(doc.get("recovery_codes") or []),
                }
            # Diagnose miss: row exists for this setup_id but wrong email or expired?
            alt = await coll.find_one({"setup_id": setup_id})
            if alt:
                exp_at = alt.get("expires_at")
                logger.info(
                    "MFA pending PEEK MISS mongo setup_id=%s...: row exists stored_email=%s query_email=%s expires_at=%s now_utc=%s",
                    setup_id[:14],
                    alt.get("email"),
                    em,
                    exp_at,
                    datetime.now(timezone.utc).isoformat(),
                )
            else:
                logger.info(
                    "MFA pending PEEK MISS mongo setup_id=%s...: no document for this setup_id",
                    setup_id[:14],
                )
    except Exception as e:
        logger.warning("MFA pending: Mongo peek failed, trying memory: %s", e)

    with _lock:
        _mem_prune()
        rec = _store.get(setup_id)
        if not rec:
            logger.info(
                "MFA pending PEEK MISS memory setup_id=%s... email=%s (no in-memory key)",
                setup_id[:14],
                em,
            )
            return None
        if rec["exp"] < time.time():
            logger.info(
                "MFA pending PEEK MISS memory setup_id=%s... email=%s (expired)",
                setup_id[:14],
                em,
            )
            return None
        if rec["email"] != em:
            logger.info(
                "MFA pending PEEK MISS memory setup_id=%s... stored_email=%s query_email=%s",
                setup_id[:14],
                rec.get("email"),
                em,
            )
            return None
        logger.info(
            "MFA pending PEEK HIT backend=memory setup_id=%s... email=%s",
            setup_id[:14],
            em,
        )
        return {"secret": rec["secret"], "recovery_codes": list(rec["recovery_codes"])}


async def pop_setup_session(setup_id: str, email: str) -> None:
    """Remove a consumed setup session after successful DB finalize."""
    if not setup_id:
        return
    em = email.strip().lower()
    try:
        from app.core.database import mongodb

        if mongodb.database is not None:
            await mongodb.database[COLLECTION].delete_many({"setup_id": setup_id, "email": em})
    except Exception as e:
        logger.warning("MFA pending: Mongo delete failed: %s", e)

    with _lock:
        rec = _store.get(setup_id)
        if rec and rec["email"] == em:
            del _store[setup_id]
