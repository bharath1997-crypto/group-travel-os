import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "../../Scram Book/Explorer Tab/Rovvy_Explorer_Scrum_Book.xlsx";
const outputPath = "./Rovvy_Explorer_Scrum_Book.xlsx";
const previewPath = "./g16-preview.png";

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Explorer Tasks");
const rows = sheet.getRange("A1:I100").values;
const rowIndex = rows.findIndex((row) => row?.[0] === "G16");

if (rowIndex < 0) throw new Error("G16 row not found");

const excelRow = rowIndex + 1;
sheet.getRange(`D${excelRow}`).values = [["Complete in code"]];
sheet.getRange(`H${excelRow}`).values = [[
  "2026-09-23: Removed unsupported Explore hub invite sheet/buttons, split placeholder, friend-attendance pills/copy, and invitation feed card. Preserved real local Save/provider handoff and the event-detail poll/share operations. Explore Vitest 44 passed (11 files); tsc --noEmit 0 errors.",
]];

workbook.recalculate();

const changed = await workbook.inspect({
  kind: "table",
  sheetId: "Explorer Tasks",
  range: `A${excelRow}:I${excelRow}`,
  include: "values,formulas",
  tableMaxRows: 2,
  tableMaxCols: 9,
  maxChars: 4000,
});
console.log(changed.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "G16 workbook formula error scan",
  maxChars: 4000,
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Explorer Tasks",
  range: `A${Math.max(1, excelRow - 2)}:I${excelRow + 2}`,
  scale: 1.5,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ excelRow, outputPath, previewPath }));
