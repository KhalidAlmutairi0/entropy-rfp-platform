"""Factory for creating Anthropic clients.

Supports two backends (checked in order):
  1. Azure AI Foundry  — when ANTHROPIC_FOUNDRY_BASE_URL + ANTHROPIC_FOUNDRY_API_KEY are set
  2. Direct Anthropic  — when ANTHROPIC_API_KEY is set

Usage:
    from services.llm_client import make_anthropic_client
    client = make_anthropic_client()
    response = await client.messages.create(model=..., ...)
"""

from anthropic import AsyncAnthropic

from core.config import settings


def make_anthropic_client() -> AsyncAnthropic:
    """Return an AsyncAnthropic client configured for whichever backend is available."""

    # Azure AI Foundry takes priority when both env vars are present
    if settings.anthropic_foundry_base_url and settings.anthropic_foundry_api_key:
        return AsyncAnthropic(
            api_key=settings.anthropic_foundry_api_key,
            base_url=settings.anthropic_foundry_base_url,
        )

    # Fall back to standard Anthropic API
    return AsyncAnthropic(api_key=settings.anthropic_api_key)
