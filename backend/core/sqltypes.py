from __future__ import annotations

from sqlalchemy import JSON, DateTime
from sqlalchemy.dialects.postgresql import JSONB


JSON_VALUE = JSON().with_variant(JSONB, "postgresql")
UTC_DATETIME = DateTime(timezone=True)
