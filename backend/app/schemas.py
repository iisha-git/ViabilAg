from pydantic import BaseModel, Field

from . import config


class ClassifyRequest(BaseModel):
    text: str = Field(min_length=config.MIN_TEXT_CHARS, max_length=config.MAX_TEXT_CHARS)


class AnalyzeRequest(ClassifyRequest):
    ph: float | None = Field(default=None, ge=0, le=14)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class ConditionsRequest(BaseModel):
    cls: str = Field(min_length=1, max_length=50)
    ph: float | None = Field(default=None, ge=0, le=14)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)


class MixCheckRequest(BaseModel):
    text_a: str = Field(min_length=config.MIN_TEXT_CHARS, max_length=config.MAX_TEXT_CHARS)
    text_b: str = Field(min_length=config.MIN_TEXT_CHARS, max_length=config.MAX_TEXT_CHARS)


class DewMessage(BaseModel):
    role: str = Field(pattern="^(user|model)$")
    text: str = Field(min_length=1, max_length=1000)


class DewContext(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    cls: str | None = Field(default=None, max_length=50)
    facts: list[str] = Field(default_factory=list, max_length=8)
    mix: str | None = Field(default=None, max_length=500)


class DewRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    lang: str = Field(default="en", pattern="^(en|hi|mr)$")
    history: list[DewMessage] = Field(default_factory=list, max_length=8)
    context: DewContext = Field(default_factory=DewContext)
