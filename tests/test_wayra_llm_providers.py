"""Tests for Wayra compact LLM provider settings."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import wayra_llm_providers as providers


def test_deepseek_model_defaults_to_v4_flash(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_MODEL", raising=False)
    monkeypatch.setattr(providers.settings, "deepseek_model", "deepseek-v4-flash")
    assert providers._deepseek_model() == "deepseek-v4-flash"


@pytest.mark.asyncio
async def test_call_deepseek_uses_v4_flash_non_thinking(monkeypatch):
    monkeypatch.setattr(providers, "_deepseek_key", lambda: "test-key")
    monkeypatch.setattr(providers, "_deepseek_model", lambda: "deepseek-v4-flash")

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "choices": [{"message": {"content": '{"message":"Hello"}'}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }

    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.services.wayra_llm_providers.httpx.AsyncClient", return_value=mock_client):
        text, usage = await providers._call_deepseek("summarize this")

    assert text == '{"message":"Hello"}'
    assert usage == {"prompt_tokens": 10, "output_tokens": 5, "total_tokens": 15}
    call_kwargs = mock_client.post.call_args.kwargs
    body = call_kwargs["json"]
    assert body["model"] == "deepseek-v4-flash"
    assert body["thinking"] == {"type": "disabled"}
