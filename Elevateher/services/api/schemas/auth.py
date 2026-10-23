import re

from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    email: str | None = None
    phone: str | None = None
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="mentee", pattern="^(mentee|mentor)$")
    age: int | None = Field(None, ge=10, le=100)
    country: str = Field(min_length=2, max_length=2)
    language: str = Field(default="en", pattern="^(en|ms|id|th|ja)$")
    guardian_email: str | None = None
    institution_code: str | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if value and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("Invalid email address")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value):
        if value and not re.match(r"^\+[1-9]\d{7,14}$", value):
            raise ValueError("Phone must be E.164 format: +60123456789")
        return value

    @field_validator("guardian_email")
    @classmethod
    def validate_minor_guardian(cls, value, info):
        age = info.data.get("age")
        if (age is None or age < 18) and not value:
            raise ValueError("Guardian email required for users under 18")
        if value and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError("Invalid guardian email address")
        return value

    def model_post_init(self, context):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required")


class LoginRequest(BaseModel):
    identifier: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int
    user_id: str
    role: str
    subdomain: str | None = None
