import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const path = 'Scram Book/Live Tab/Rovvy_Live_Scrum_Book.xlsx';
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const sheet = wb.worksheets.getItem('Live Tasks');
const rows = sheet.getRange('A7:K338').values;
const index = (id) => 7 + rows.findIndex((row) => row[0] === id);
const set = (id, col, value) => sheet.getRange(`${col}${index(id)}`).values = [[value]];
for (const id of ['L179', 'L180', 'L181', 'L182']) if (index(id) < 7) throw Error(`Missing ${id}`);
set('L179', 'G', 'Provide next-turn distance only after live step progress is implemented.');
set('L179', 'H', '25 Sep: guessed 0.1 mi turn label removed; no live step distance yet.');
set('L180', 'D', 'Complete in code');
set('L180', 'G', 'Verify Solo overlay does not show lane arrows without lane data.');
set('L180', 'H', '25 Sep: generated arrows removed from Solo overlay; navigation unit test passed.');
set('L181', 'G', 'Track route progress from moving GPS; current figure is labelled full route distance.');
set('L181', 'H', '25 Sep: 0 m LEFT label removed; route distance uses provider distance and is labelled Route. Live progress remains unimplemented.');
set('L182', 'G', 'Verify route-duration arrival estimate, then update it from live progress.');
set('L182', 'H', '25 Sep: arrival estimate now derives from provider duration; no live recalculation yet.');

const review = wb.worksheets.getItem('Review');
const reviewRows = review.getRange('A1:D40').values;
const rowFor = (label) => 1 + reviewRows.findIndex((row) => row[0] === label);
function reviewSet(label, col, value) {
  const row = rowFor(label);
  if (row < 1) throw Error(`Missing review label ${label}`);
  review.getRange(`${col}${row}`).values = [[value]];
}
reviewSet('Navigation progress mismatch', 'B', 'The fabricated 0.1 mi turn and 0 m LEFT pairing has been removed; full route metrics now use provider data.');
reviewSet('Navigation progress mismatch', 'C', 'Implement GPS-linked route progress, next-step distance and ETA recalculation.');
reviewSet('Navigation progress mismatch', 'D', '25 Sep code + unit test; movement and browser route scenario still need QA.');
reviewSet('Verified sample', 'B', 'Previous browser sample plus 25 Sep source gap audit: 20 new map-popup, trip-HUD and border-notice items.');
reviewSet('Result', 'B', '332-item inventory; initial Critical navigation truth fix implemented.');
reviewSet('Result', 'C', 'Next: live GPS route progress, truthful action persistence and discovery-layer failure.');
reviewSet('Result', 'D', '25 Sep: targeted navigation tests and TypeScript type check passed; no live GPS verification.');
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(path);
console.log('Workbook reconciliation saved');
