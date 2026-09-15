"""
Benchmark 100 Wayra questions across categories — Case PREVIOUS vs Case CURRENT.
Generates a full HTML comparison report.
"""
from __future__ import annotations

import asyncio
import html
import json
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.schemas.ai_assistant import AIAssistantRequest
from app.services.wayra_answer_grading import grade_answer_row
from app.services.ai_assistant_service import AIAssistantService

# Google Maps pin: Red Square, Moscow, Russia
# https://www.google.com/maps/place/Red+Square/@55.7539307,37.6207953,17z
PLACE = {
    "name": "Red Square",
    "lat": 55.7539307,
    "lng": 37.6207953,
    "city": "Moscow",
    "state": "Moscow",
    "country": "Russia",
    "address": "Red Square, Moscow, Russia, 109012",
    "category": "landmark",
}

CONTEXT: dict[str, Any] = {
    "page": "live",
    "pathname": "/live",
    "selectedPlace": PLACE,
    "resolvedMapRegion": "Moscow, Russia",
    "userLocation": {
        "lat": 40.7128,
        "lng": -74.0060,
        "city": "New York",
        "state": "New York",
        "country": "United States",
    },
    "chatAttachedLocation": {
        "label": "Red Square",
        "lat": 55.7539307,
        "lng": 37.6207953,
        "source": "map_pin",
    },
}

# 100 questions — 12 categories
QUESTIONS: list[tuple[str, str]] = [
    # 1 Meta / AI routing (8)
    ("meta_ai", "Are you using Gemini or DeepSeek?"),
    ("meta_ai", "How does Wayra AI work behind the scenes?"),
    ("meta_ai", "What model powers your answers?"),
    ("meta_ai", "Is this Google AI or something else?"),
    ("meta_ai", "Do you use OpenAI?"),
    ("meta_ai", "Who built Wayra?"),
    ("meta_ai", "Are you a real person or AI?"),
    ("meta_ai", "How do you choose which AI to use?"),
    # 2 Future (8)
    ("future", "What cultural event is going to happen here soon?"),
    ("future", "Will there be a parade at Red Square this month?"),
    ("future", "What is the future of tourism in Moscow?"),
    ("future", "Are there upcoming festivals near Red Square?"),
    ("future", "Will this place be crowded next weekend?"),
    ("future", "What events are planned at the Kremlin?"),
    ("future", "Is Victory Day celebration happening here?"),
    ("future", "What will Moscow look like for visitors in 2027?"),
    # 3 Food (10)
    ("food", "How is the food here?"),
    ("food", "What is the must-try food near Red Square?"),
    ("food", "What kind of foods like beef, pepperoni, or chicken are available?"),
    ("food", "How many vegetarian options are available?"),
    ("food", "What do locals eat in Moscow?"),
    ("food", "Any street food around here?"),
    ("food", "Is there good coffee near Red Square?"),
    ("food", "What is the local specialty dish?"),
    ("food", "Where can I grab a bite near here?"),
    ("food", "Is Russian cuisine spicy?"),
    # 4 Clothing (8)
    ("clothing", "What kind of clothes should I wear?"),
    ("clothing", "What should I pack for Red Square?"),
    ("clothing", "Do I need a heavy coat in Moscow?"),
    ("clothing", "Is it too hot or cold here right now?"),
    ("clothing", "What shoes should I wear for walking here?"),
    ("clothing", "Do I need formal clothes to visit Red Square?"),
    ("clothing", "What season is best to visit?"),
    ("clothing", "Should I bring an umbrella?"),
    # 5 Weather (8)
    ("weather", "What's the weather like here?"),
    ("weather", "Any weather warnings for Moscow?"),
    ("weather", "Is it snowing in Moscow now?"),
    ("weather", "Best time of year to visit Red Square?"),
    ("weather", "When should I avoid visiting?"),
    ("weather", "When is peak season here?"),
    ("weather", "Is Moscow good to visit right now?"),
    ("weather", "Does it rain a lot in Moscow?"),
    # 6 Travel (12)
    ("travel", "How far is it from me?"),
    ("travel", "How long is the drive to Red Square?"),
    ("travel", "Best route to Red Square?"),
    ("travel", "How do I get to Red Square?"),
    ("travel", "Is there parking near Red Square?"),
    ("travel", "Can I walk to Red Square from here?"),
    ("travel", "Any route warnings to Red Square?"),
    ("travel", "How is traffic to Red Square?"),
    ("travel", "Is Red Square near a border?"),
    ("travel", "What is the last mile like here?"),
    ("travel", "Is Red Square accessible by car?"),
    ("travel", "How much time do I need at Red Square?"),
    # 7 Cultural (10)
    ("cultural", "What's the local culture like here?"),
    ("cultural", "What makes Red Square worth visiting?"),
    ("cultural", "Why is Red Square famous?"),
    ("cultural", "Any customs I should know here?"),
    ("cultural", "What's etiquette like in Moscow?"),
    ("cultural", "What's special about this place?"),
    ("cultural", "Any hidden gems near Red Square?"),
    ("cultural", "What can I do here?"),
    ("cultural", "What activities are near Red Square?"),
    ("cultural", "What should I not miss here?"),
    # 8 Language (6)
    ("language", "What language do they speak here?"),
    ("language", "Do people speak English in Moscow?"),
    ("language", "What should I know about the people here?"),
    ("language", "Are people friendly here?"),
    ("language", "How do I say hello in Russian?"),
    ("language", "Is Russian the main language in Moscow?"),
    # 9 GPS / location (10)
    ("gps_location", "What is this location?"),
    ("gps_location", "What is this place?"),
    ("gps_location", "Where exactly is this spot?"),
    ("gps_location", "What are the coordinates here?"),
    ("gps_location", "What am I looking at on the map?"),
    ("gps_location", "What county or region is this in?"),
    ("gps_location", "What's the name of this pin?"),
    ("gps_location", "Is this a landmark or a city?"),
    ("gps_location", "What is the address of this pin?"),
    ("gps_location", "Tell me about this picked location."),
    # 10 Crime / safety (8)
    ("crime_safety", "Any restrictions visiting Red Square?"),
    ("crime_safety", "Is Red Square safe?"),
    ("crime_safety", "Any safety concerns here?"),
    ("crime_safety", "Should I be careful here?"),
    ("crime_safety", "Any warnings about this area?"),
    ("crime_safety", "Is Moscow safe for tourists?"),
    ("crime_safety", "What do I need to prepare before going here?"),
    ("crime_safety", "Are there entry fees at Red Square?"),
    # 11 Normal conversation (6)
    ("conversation", "Hello Wayra!"),
    ("conversation", "Thanks for your help."),
    ("conversation", "That's interesting, tell me more."),
    ("conversation", "Good morning!"),
    ("conversation", "You're awesome."),
    ("conversation", "What else can you help with?"),
    # 12 User interaction / app (6)
    ("user_interaction", "How does Live work?"),
    ("user_interaction", "How do I start a trip?"),
    ("user_interaction", "How do I share my location?"),
    ("user_interaction", "How do I create a group?"),
    ("user_interaction", "What does the pencil icon do?"),
    ("user_interaction", "How do I switch travel modes?"),
]

assert len(QUESTIONS) == 100


@contextmanager
def case_previous_patches():
    """Simulate pre–Case-3 behavior: Gemini-first location_hard, no live travel override, no local distance."""
    import app.services.wayra_llm_providers as llm
    import app.services.wayra_source_intent as intent

    old_discovery_re = intent._DISCOVERY_FIRST_RE

    async def old_summarize(*, user_message, place_label, source_block, tier):
        user_block = (
            f"Place context: {place_label}\n"
            f"User question: {user_message}\n\n"
            f"SOURCE SNIPPETS:\n{source_block}\n\n"
            'Reply with JSON only: {"message": "..."}'
        )
        if tier == "location_hard" and llm._gemini_key():
            try:
                text, usage = await llm._call_gemini_compact(user_block)
                llm.record_gemini_usage(
                    feature="wayra_location_hard", model=llm._GEMINI_MODEL, usage=usage
                )
                return llm._parse_summary_json(text), "gemini", usage
            except Exception:
                pass
        if llm._deepseek_key():
            try:
                text, usage = await llm._call_deepseek(user_block)
                llm.record_gemini_usage(
                    feature="wayra_discovery", model=llm._deepseek_model(), usage=usage
                )
                return llm._parse_summary_json(text), "deepseek", usage
            except Exception:
                pass
        if llm._gemini_key():
            try:
                text, usage = await llm._call_gemini_compact(user_block)
                return llm._parse_summary_json(text), "gemini", usage
            except Exception:
                pass
        first = source_block.split("\n")[0].strip() if source_block else ""
        return (
            f"Here's what I found for {place_label}. {first} Open the source links below.",
            "template",
            None,
        )

    narrow_discovery = __import__("re").compile(
        r"\b(must try|must-try|must try food|local specialty|locals eat|street food|food culture|cuisine|"
        r"local culture|culture like|what can i do|things to do|activities|what s special|"
        r"anything fun|worth the trip)\b",
        __import__("re").I,
    )

    with (
        patch.object(intent, "_DISCOVERY_FIRST_RE", narrow_discovery),
        patch.object(llm, "summarize_from_sources", side_effect=old_summarize),
        patch(
            "app.services.ai_assistant_service._extract_live_selected_place",
            return_value=None,
        ),
        patch(
            "app.services.wayra_answer_service.WayraAnswerService._try_local_distance_answer",
            return_value=None,
        ),
    ):
        yield


async def ask_one(category: str, question: str) -> dict[str, Any]:
    req = AIAssistantRequest(page="live", user_message=question, context=CONTEXT)
    t0 = time.perf_counter()
    try:
        resp = await AIAssistantService.respond(req)
        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        summary = resp.summary or {}
        usage = summary.get("usage") or summary.get("gemini_usage") or {}
        tokens = int(usage.get("total_tokens") or 0) if isinstance(usage, dict) else 0
        return {
            "category": category,
            "question": question,
            "message": resp.message,
            "provider": summary.get("provider") or ("local" if summary.get("local") else "gemini" if summary.get("gemini_usage") else "unknown"),
            "intent": summary.get("intent") or summary.get("tier") or summary.get("mode") or "",
            "local": bool(summary.get("local")),
            "sources_count": len(resp.sources or []),
            "tokens": tokens,
            "elapsed_ms": elapsed_ms,
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "category": category,
            "question": question,
            "message": "",
            "provider": "error",
            "intent": "",
            "local": False,
            "sources_count": 0,
            "tokens": 0,
            "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            "error": f"{type(exc).__name__}: {exc}",
        }


async def run_case(case_name: str, patch_ctx: Callable | None) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    ctx = patch_ctx() if patch_ctx else nullcontext()
    with ctx:
        for i, (cat, q) in enumerate(QUESTIONS, 1):
            print(f"[{case_name}] {i}/100 {cat}: {q[:50]}...", flush=True)
            row = await ask_one(cat, q)
            row["case"] = case_name
            row["grades"] = grade_answer_row(cat, q, row)
            results.append(row)
            await asyncio.sleep(0.15)
    return results


class nullcontext:
    def __enter__(self):
        return None

    def __exit__(self, *args):
        return False


def provider_stats(rows: list[dict]) -> dict[str, int]:
    out: dict[str, int] = {}
    for r in rows:
        p = str(r.get("provider") or "unknown")
        out[p] = out.get(p, 0) + 1
    return out


def token_total(rows: list[dict]) -> int:
    return sum(int(r.get("tokens") or 0) for r in rows)


def build_html(previous: list[dict], current: list[dict]) -> str:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    prev_stats = provider_stats(previous)
    curr_stats = provider_stats(current)
    prev_tokens = token_total(previous)
    curr_tokens = token_total(current)
    savings = prev_tokens - curr_tokens
    savings_pct = round(100 * savings / prev_tokens, 1) if prev_tokens else 0

    savings_pct = round(100 * savings / prev_tokens, 1) if prev_tokens else 0
    curr_scores = [int((r.get("grades") or {}).get("human_score_1_to_5") or 0) for r in current]
    avg_score = round(sum(curr_scores) / len(curr_scores), 2) if curr_scores else 0

    categories = sorted({c for c, _ in QUESTIONS})

    rows_html = []
    for i, ((cat, q), prev, curr) in enumerate(zip(QUESTIONS, previous, current, strict=True)):
        same = prev["message"].strip() == curr["message"].strip()
        g = curr.get("grades") or {}
        grade_s = (
            f"ans:{g.get('question_answered')} · "
            f"fact:{g.get('factually_supported')} · "
            f"loc:{g.get('location_grounded')} · "
            f"score:{g.get('human_score_1_to_5')}/5"
        )
        rows_html.append(
            f"""
            <tr class="{'same' if same else 'diff'}">
              <td>{i + 1}</td>
              <td><span class="cat">{html.escape(cat)}</span></td>
              <td class="q">{html.escape(q)}</td>
              <td><span class="prov prev">{html.escape(str(prev.get('provider')))}</span><br/>
                  <small>{html.escape(str(prev.get('intent')))}</small><br/>
                  <small>{prev.get('tokens', 0)} tok · {prev.get('elapsed_ms')}ms</small></td>
              <td class="ans prev">{html.escape(prev.get('message', '')[:800])}</td>
              <td><span class="prov curr">{html.escape(str(curr.get('provider')))}</span><br/>
                  <small>{html.escape(str(curr.get('intent')))}</small><br/>
                  <small>{curr.get('tokens', 0)} tok · {curr.get('elapsed_ms')}ms</small></td>
              <td class="ans curr">{html.escape(curr.get('message', '')[:800])}</td>
              <td><small>{html.escape(grade_s)}</small></td>
            </tr>"""
        )

    cat_summary_rows = []
    for cat in categories:
        p_rows = [r for r in previous if r["category"] == cat]
        c_rows = [r for r in current if r["category"] == cat]
        cat_summary_rows.append(
            f"""<tr>
              <td>{html.escape(cat)}</td>
              <td>{len(p_rows)}</td>
              <td>{html.escape(json.dumps(provider_stats(p_rows)))}</td>
              <td>{token_total(p_rows):,}</td>
              <td>{html.escape(json.dumps(provider_stats(c_rows)))}</td>
              <td>{token_total(c_rows):,}</td>
            </tr>"""
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Wayra 100Q Benchmark — Red Square Moscow</title>
<style>
  :root {{ font-family: Inter, system-ui, sans-serif; color: #0f172a; }}
  body {{ margin: 0; background: #f8fafc; }}
  header {{ background: #0f766e; color: white; padding: 2rem; }}
  header h1 {{ margin: 0 0 .5rem; font-size: 1.75rem; }}
  .wrap {{ max-width: 1400px; margin: 0 auto; padding: 1.5rem; }}
  .cards {{ display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 1rem; margin: 1rem 0 2rem; }}
  .card {{ background: white; border-radius: 12px; padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
  .card h3 {{ margin: 0 0 .5rem; font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }}
  .card .big {{ font-size: 1.5rem; font-weight: 700; color: #0f766e; }}
  table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); font-size: .82rem; }}
  th, td {{ border-bottom: 1px solid #e2e8f0; padding: .6rem .75rem; vertical-align: top; text-align: left; }}
  th {{ background: #0f172a; color: white; position: sticky; top: 0; z-index: 1; }}
  tr.diff {{ background: #fffbeb; }}
  tr.same {{ background: #f0fdf4; }}
  .cat {{ background: #ecfeff; color: #0f766e; padding: .15rem .45rem; border-radius: 6px; font-size: .75rem; }}
  .prov {{ font-weight: 600; font-size: .78rem; }}
  .prov.prev {{ color: #7c3aed; }}
  .prov.curr {{ color: #0f766e; }}
  .q {{ max-width: 200px; font-weight: 500; }}
  .ans {{ max-width: 320px; line-height: 1.45; white-space: pre-wrap; }}
  section {{ margin-bottom: 2.5rem; }}
  h2 {{ color: #0f172a; border-bottom: 2px solid #0f766e; padding-bottom: .35rem; }}
  .note {{ background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem 1.25rem; border-radius: 0 8px 8px 0; margin: 1rem 0; }}
  .legend {{ display: flex; gap: 1rem; flex-wrap: wrap; font-size: .85rem; }}
  .legend span {{ padding: .25rem .5rem; border-radius: 6px; }}
</style>
</head>
<body>
<header>
  <h1>Wayra 100-Question Benchmark Report</h1>
  <p>Location: Red Square, Moscow, Russia (Google Maps pin 55.7539307, 37.6207953) · User GPS: New York · Generated {ts}</p>
</header>
<div class="wrap">
  <div class="note">
    <strong>Case PREVIOUS</strong> = Gemini-first on route-hard, no live-pin travel routing, no free local distance.<br/>
    <strong>Case CURRENT</strong> = Cost-quality tiers: local GPS/distance, DeepSeek discovery, Gemini route-hard fallback.
  </div>

  <div class="cards">
    <div class="card"><h3>Case PREVIOUS tokens</h3><div class="big">{prev_tokens:,}</div></div>
    <div class="card"><h3>Case CURRENT tokens</h3><div class="big">{curr_tokens:,}</div></div>
    <div class="card"><h3>Token savings</h3><div class="big">{savings:,} ({savings_pct}%)</div></div>
    <div class="card"><h3>CURRENT avg quality score</h3><div class="big">{avg_score}/5</div></div>
    <div class="card"><h3>PREVIOUS providers</h3><div class="big" style="font-size:.95rem">{html.escape(json.dumps(prev_stats))}</div></div>
    <div class="card"><h3>CURRENT providers</h3><div class="big" style="font-size:.95rem">{html.escape(json.dumps(curr_stats))}</div></div>
  </div>

  <section>
    <h2>Category summary</h2>
    <table>
      <thead><tr><th>Category</th><th>Q</th><th>PREVIOUS providers</th><th>PREVIOUS tokens</th><th>CURRENT providers</th><th>CURRENT tokens</th></tr></thead>
      <tbody>{''.join(cat_summary_rows)}</tbody>
    </table>
  </section>

  <section>
    <h2>All 100 questions — side by side</h2>
    <div class="legend">
      <span style="background:#fffbeb">Different answers</span>
      <span style="background:#f0fdf4">Same answers</span>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>Category</th><th>Question</th>
        <th>PREVIOUS meta</th><th>PREVIOUS answer</th>
        <th>CURRENT meta</th><th>CURRENT answer</th><th>Quality grades</th></tr>
      </thead>
      <tbody>{''.join(rows_html)}</tbody>
    </table>
  </section>
</div>
</body>
</html>"""


async def main() -> None:
    out_dir = ROOT / "reports"
    out_dir.mkdir(exist_ok=True)

    print("Running Case PREVIOUS (100 questions)...", flush=True)
    previous = await run_case("PREVIOUS", case_previous_patches)

    print("Running Case CURRENT (100 questions)...", flush=True)
    current = await run_case("CURRENT", None)

    json_path = out_dir / "wayra_100q_benchmark.json"
    json_path.write_text(
        json.dumps({"previous": previous, "current": current, "place": PLACE}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    html_path = out_dir / "wayra_100q_benchmark_report.html"
    html_path.write_text(build_html(previous, current), encoding="utf-8")

    print(f"\nDone.\nJSON: {json_path}\nHTML: {html_path}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
