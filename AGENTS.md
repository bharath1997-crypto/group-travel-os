## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Imported Claude Cowork project instructions

## Scram Book documentation protocol

- The authoritative project documentation workspace is `D:\group travel os\Scram Book` (the folder name is intentionally `Scram`, not `Scrum`).
- Before planning or changing a product area, inspect the matching subfolder and its current workbook/report so existing decisions, sprint goals, risks, and acceptance criteria are not duplicated or contradicted.
- Travel-unit work belongs in `Scram Book\Travel Tab`. Flights work must review `Rovvy_Travel_Flights_Scrum_Plan.xlsx` and `Rovvy_Flights_Detailed_Product_Report.docx` when present.
- After verified implementation, bug fixing, UI changes, provider/API work, research decisions, or planning, update the relevant Scram Book artifact with the date, work context, goals addressed, result, tests/verification, unresolved risks, and next action.
- Do not create competing planning files elsewhere. Create a new product-area subfolder under `Scram Book` only when no suitable area exists; keep generated/temp files out of it.
- Documentation updates must describe completed facts accurately. Do not mark work complete, claim live provider data, or record passing tests without verification.
