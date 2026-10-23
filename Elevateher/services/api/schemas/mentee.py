from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class SDGTrack(str, Enum):
    STEM = "STEM"
    Business = "Business"
    Trades = "Trades"
    Creative = "Creative"
    Healthcare = "Healthcare"


class MenteeProfileCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    display_name: str | None = Field(None, max_length=50)
    career_goals: list[str] = Field(min_length=1, max_length=5)
    sdg_track: SDGTrack
    current_education: str | None = Field(None, max_length=200)
    education_level: str | None = None
    preferred_languages: list[str] = Field(default=["en"], max_length=5)
    challenges: list[str] = Field(default=[])
    bio_short: str | None = Field(None, max_length=160)


class MenteeProfileUpdate(MenteeProfileCreate):
    full_name: str | None = Field(None, min_length=2, max_length=100)
    career_goals: list[str] | None = None
    sdg_track: SDGTrack | None = None


class MenteeProfileResponse(BaseModel):
    id: str
    user_id: str
    full_name: str | None
    display_name: str | None
    career_goals: list[str]
    sdg_track: str
    current_education: str | None
    preferred_languages: list[str]
    challenges: list[str]
    bio_short: str | None
    onboarding_complete: bool

    model_config = ConfigDict(from_attributes=True)


class MentorCandidateResponse(BaseModel):
    mentor_id: str
    mentor_name: str
    job_title: str
    industry: str
    years_exp: int
    languages: list[str]
    match_score: float
    match_reason: str
    bio_preview: str


class MatchResponse(BaseModel):
    match_id: str
    mentor_id: str
    mentor_name: str
    mentor_job_title: str
    mentor_industry: str
    mentor_years_exp: int
    mentor_languages: list[str]
    match_score: float
    match_reason: str
    sdg_track: str
    status: str
    started_at: str | None = None
