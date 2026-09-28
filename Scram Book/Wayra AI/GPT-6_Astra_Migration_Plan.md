# Wayra migration to GPT-6 Astra

Date: 2026-09-22. Status: planning complete; implementation and live validation not started.

## Scope and recommendation

Treat this request as migration of Rovvy's application AI, not a change to the Codex task model. Introduce `gpt-6-astra` as Wayra's complex-answer provider behind a disabled-by-default rollout flag. Preserve deterministic local replies, economical summaries, voice behavior, and existing availability fallbacks. Expanding Astra to other workloads requires evidence from evaluations rather than a global model replacement.

This is a new Wayra-specific Scram Book area because the existing folders cover individual product tabs. No existing Wayra workbook or report was found. Reviewed the root Scram Book protocol, development-status report text, and Explorer record. This plan does not change Flights providers, booking behavior, or product acceptance status.

## Verified repository baseline

- `app/services/ai_assistant_service.py`: `respond()` attempts local, knowledge, app-guide, and hybrid travel answers before `generate_wayra_full_response()`. `_call_openai()` uses Responses with `gpt-4o-mini`, temperature, and a 60-second timeout, but the inspected application has no call site for that helper. Updating its constant alone would not migrate the active flow.
- `app/services/wayra_llm_providers.py`: both full answers and source summaries use DeepSeek-controlled routing to DeepSeek/Gemini; voice and compact summaries have direct DeepSeek paths. Both entry points need explicit migration coverage.
- `config.py`: OpenAI key support already exists; DeepSeek defaults to `deepseek-v4-flash`. `requirements.txt` and `requirements-prod.txt` pin `openai==2.32.0`.
- `app/services/wayra_output_budget.py`: current visible-answer budgets range from 180 tokens for voice to 2,048 for full answers. `wayra_routing.py` uses 12/40-second simple/complex timeout values; these are not evidence of an enforced total deadline across sequential provider calls.
- `app/schemas/ai_assistant.py`: preserve `message`, `suggested_actions`, `sources`, and `summary` contracts. Full answers currently rely on JSON parsing/coercion.
- `app/services/gemini_usage.py` and `/ai/usage`: usage reporting is process-local and Gemini-named, although other providers already record through it.
- `/ai/assistant` is browse-first without a login dependency. The inspected main flow does not call the personal/group rate limiter; verify global middleware before exposing a higher-cost route.
- Existing evaluation assets include `tests/test_wayra_*.py`, `scripts/wayra_100q_benchmark.py`, and historical reports. The benchmark's fixed Red Square context is insufficient by itself for global acceptance.

## Ordered implementation plan

### 1. Establish baseline and configuration

Capture current routing, answer quality, latency, and per-request token usage on a fixed evaluation set. Preserve historical reports. Confirm Astra access for the deployment account and region using a small staging probe during implementation; access has not been checked in this planning task.

Add proposed settings in `config.py`: `WAYRA_ASTRA_ENABLED=false`, `WAYRA_ASTRA_MODEL=gpt-6-astra`, reasoning effort, rollout percentage, request deadline, and a separate output cap. Keep the existing secret-loading path. Validate the pinned SDK against the required request fields; upgrade both dependency files together only if compatibility requires it.

Acceptance: flag-off behavior matches the existing route; missing credentials fail safely without selecting Astra; configuration and request-construction tests pass.

### 2. Add a bounded asynchronous provider adapter

Implement an async Astra adapter in the provider layer, using Responses. Start evaluation at low reasoning effort, remove sampling parameters from Astra requests, and return normalized text plus usage. Official OpenAI guidance requires Responses for Astra tool calls and excludes temperature, top_p, and top_logprobs. The current integration passes text/context rather than function tools, so introducing tools is not required for this migration. [Official migration guidance](https://developers.openai.com/api/docs/guides/latest-model#update-api-and-model-parameters)

Handle timeout, cancellation, 429/5xx, unavailable model, refusal, empty output, malformed JSON, and incomplete responses distinctly. Bound retries and fallback calls by one remaining-time budget. Do not reuse the synchronous, inactive helper directly inside the async service.

Maintain the existing outward response contract and server-owned source attribution. Separate Astra generation limits from UI character limits; tune sufficient output capacity during evaluation rather than blindly reusing short-summary caps. Add schema validation before publishing actions or displaying generated JSON.

Acceptance: mocked success and failure cases produce a valid existing response or a controlled fallback, without blocking the event loop or retry loops.

### 3. Connect both active routes

For the first rollout, select Astra deterministically for eligible non-voice `plan`/`location_hard` source summaries and complex full-assistant requests. Make this selection before the DeepSeek controller so eligible requests avoid paying for an extra routing call. Keep the previous provider cascade as a bounded fallback when time remains; otherwise return the existing local degraded answer.

Preserve local/knowledge answers, compact nearby summaries, and voice routing. Include the same selected-place, origin, group, and page context as the current path. Avoid adding Astra into the DeepSeek route enum in this first version; server configuration should control eligibility and rollout.

Review relevant prompt builders for concise answers, required output fields, useful assumptions, and focused clarification when missing information changes the answer. Keep source snippets as untrusted evidence and retain existing limits on claims about live inventory or available actions. Do not copy coding-agent autonomy prompts into the travel assistant.

Acceptance: tests prove eligible requests actually invoke Astra in both paths and ineligible requests make zero Astra calls. Existing source links, action rendering, and voice caps remain compatible.

### 4. Add rollout observability and spending controls

Record provider, model, route, duration, completion status, fallback reason, and token usage per attempt, retaining totals when multiple providers run. Extend usage reporting compatibly or add a new versioned response; do not silently change `/ai/usage` consumers. Avoid recording secrets or unnecessary user context.

Verify deployed ingress limits, then enforce a bounded Astra request budget for anonymous traffic as needed. Set daily spending and concurrency limits before public rollout. Determine the allowed cost per successful answer from measured usage and current official pricing; no budget or savings claim is established here.

Acceptance: dashboards distinguish Astra from existing providers, costs include retries/fallbacks, and exhausted budget routes predictably to existing behavior.

### 5. Evaluate and release gradually

Run targeted provider, routing, prompt, output-budget, voice, source-grounding, place-context, and trip-planning tests. Extend the 100-question harness to compare the frozen existing route with Astra on identical inputs. Add multiple locations, missing origin/dates, ambiguous places, source outages, malicious source text, and provider failures. Use sanitized fixtures for offline tests, then clearly label separately funded staging/API evaluations.

Proposed release gates: all routing/contract regression tests pass; no unsupported source or action claims in the reviewed cases; human-reviewed complex-answer quality is at least baseline; p95 completion fits the configured deadline; measured cost per successful answer stays within the chosen budget. These gates are proposals, not achieved results.

Roll out to internal traffic, then 5%, 25%, and 100% of eligible complex requests, advancing only after each cohort meets the gates. Keep a stable assignment per user/session where available. Rollback is `WAYRA_ASTRA_ENABLED=false`, restoring the prior route. Test rollback before the first public cohort. Broader standard/voice adoption is a later evaluation decision.

After implementation, run `graphify update .` and append actual tests, cohort evidence, outstanding risks, and decisions to this record.

## Verification, risks, and next action

Planning verification completed: official OpenAI page fetched; graph queried successfully using `.venv/Scripts/python.exe -m graphify`; active source paths, configuration, schemas, test assets, and Scram Book records inspected. The skill's specific Markdown migration URL failed twice with unsupported content-type; the official HTML migration section supplied the guidance used above.

No application code, model configuration, dependency, or deployment was changed. No tests, benchmark, paid API request, model-access probe, or production validation ran. The working tree contains substantial pre-existing changes; implementation must preserve them and review overlapping files before editing.

Unresolved: account access, exact SDK compatibility, production region, global ingress controls, approved cost ceiling, live latency, and quality improvement. These are implementation/evaluation gates, not reasons to claim the migration already works.

Next action: implement baseline fixtures, feature configuration, and the async adapter with mocked contract tests; then connect and evaluate the two eligible routes.
