from enum import Enum

from pydantic import BaseModel, Field


class VerificationStatus(str, Enum):
    pending_id = "pending_id"
    pending_admin_review = "pending_admin_review"
    approved = "approved"
    rejected = "rejected"
    suspended = "suspended"


class MentorProfileCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    display_name: str | None = Field(None, max_length=50)
    job_title: str = Field(min_length=2, max_length=120)
    employer: str
    industry: str
    years_exp: int = Field(ge=0, le=60)
    skills: list[str] = Field(default=[])
    languages: list[str] = Field(default=["en"], max_length=8)
    bio: str = Field(min_length=100, max_length=5000)
    linkedin_url: str | None = None
    availability: dict = Field(default_factory=dict)
    sdg_track: str | None = None
