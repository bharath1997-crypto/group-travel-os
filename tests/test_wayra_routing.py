from app.services.wayra_routing import (
    is_complex_wayra_question,
    llm_timeout_seconds,
)


def test_simple_question_short_timeout():
    assert is_complex_wayra_question("what is time now?") is False
    assert llm_timeout_seconds("what is time now?") == 12.0


def test_multi_line_question_complex():
    msg = "What restaurants are near here?\nAlso what should we do tonight?"
    assert is_complex_wayra_question(msg) is True
    assert llm_timeout_seconds(msg) == 40.0
