## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Scram Book documentation protocol

- Treat `D:\group travel os\Scram Book` as the authoritative product planning and activity record (the folder is intentionally named `Scram Book`).
- Before product planning or implementation, inspect the relevant subfolder and existing workbook/report. Travel and Flights work belongs in `Scram Book\Travel Tab` and must consult the Flights Scrum plan and detailed product report when present.
- After verified work, update the matching artifact with date, context, goals addressed, result, verification, unresolved risks, and next action. Never claim completion, live data, or passing tests without evidence.
- Do not create duplicate roadmaps or reports elsewhere. Add a new product-area folder under `Scram Book` only when necessary.
