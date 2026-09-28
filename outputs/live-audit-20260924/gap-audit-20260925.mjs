import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const path = 'Scram Book/Live Tab/Rovvy_Live_Scrum_Book.xlsx';
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const sheet = wb.worksheets.getItem('Live Tasks');
const table = sheet.tables.items.find((item) => item.name === 'LiveFeatures');
if (!table || sheet.getRange('B3').values[0][0] !== 312) throw Error('Unexpected inventory revision');

// Each entry is a distinct, inspectable affordance missed in the first audit.
const additions = [
  ['Map point popup','Coordinate readout for selected map point','Complete in code','Important','Easy','Check latitude/longitude against selected point.','Code only: LiveMapClickPopup.tsx','Feature','Provides precise context when selecting an unlabelled point.'],
  ['Map point popup','Map-point local clock','Partial','Important','Moderate','Open points across timezones and compare clocks.','Code only: LiveMapClickPopup.tsx; live-map-local-time.ts','UI extension','Local time helps coordinate calls and arrival.'],
  ['Map point popup','Timezone lookup loading label','Complete in code','Later','Easy','Check pending label and settlement.','Code only: LiveMapClickPopup.tsx','UI extension','Shows when the clock is still resolving.'],
  ['Map point popup','Timezone name below map-point clock','Partial','Important','Moderate','Check named timezone for border points.','Code only: LiveMapClickPopup.tsx','UI extension','Prevents ambiguity around local time.'],
  ['Map point popup','Approximate-time disclosure','Complete in code','Critical','Moderate','Force timezone lookup failure and inspect estimated label.','Code only: LiveMapClickPopup.tsx; live-map-local-time.ts','Feature','A longitude estimate must not appear authoritative.'],
  ['Map point popup','Pick this location action','Partial','Critical','Moderate','Pick and verify exact selected place in panel.','Code only: LiveMapClickPopup.tsx','Feature','Completes map-point selection.'],
  ['Map point popup','Pin coordinates here action','Partial','Important','Moderate','Pin and verify the marker persists as intended.','Code only: LiveMapClickPopup.tsx','Feature','Supports exact coordinate use without a POI.'],
  ['Map point popup','Popup viewport clamping','Complete in code','Important','Moderate','Open near each screen edge at mobile width.','Code only: LiveMapClickPopup.tsx','Graphic','Keeps actions visible near map edges.'],
  ['Map point popup','Backdrop click closes popup','Complete in code','Important','Easy','Open popup and click outside.','Code only: LiveMapClickPopup.tsx','UI extension','Provides a clear exit from temporary map actions.'],
  ['Trip HUD','Collapsed live-trip capsule','Complete in code','Important','Easy','Enter Live and verify capsule opens details.','Code only: LiveMiniHud.tsx','UI extension','Keeps trip context compact over the map.'],
  ['Trip HUD','Expanded live-trip HUD','Complete in code','Important','Easy','Expand and collapse without resetting trip.','Code only: LiveMiniHud.tsx','UI extension','Exposes status and controls on demand.'],
  ['Trip HUD','Travel-mode icon in HUD','Complete in code','Later','Easy','Switch Drive/Bike/Trek/Walk and compare icon.','Code only: LiveMiniHud.tsx','Graphic','Makes current mode recognizable.'],
  ['Trip HUD','Workflow badge in HUD','Complete in code','Important','Easy','Check Solo/Group/Share state after switching.','Code only: LiveMiniHud.tsx','UI extension','Prevents confusion about which journey is active.'],
  ['Trip HUD','HUD setup edit action','Partial','Important','Moderate','Open setup from HUD and retain route choices.','Code only: LiveMiniHud.tsx','Feature','Allows corrections mid-trip.'],
  ['Trip HUD','HUD speed readout','Partial','Critical','Moderate','Compare speed with device location updates.','Code only: LiveMiniHud.tsx','Graphic','Speed must reflect fresh GPS rather than stale movement.'],
  ['Trip HUD','HUD remaining-time readout','Partial','Critical','Hard','Compare shown duration with live route progress.','Code only: LiveMiniHud.tsx','Graphic','Static route duration should not be claimed as live remaining time.'],
  ['Trip HUD','Idle/slow/moving status indicator','Partial','Important','Moderate','Test GPS speed thresholds and stale GPS.','Code only: LiveMiniHud.tsx','Graphic','Movement state needs clear data freshness.'],
  ['Map notices','Cross-border country pair notice','Partial','Critical','Hard','Route across a border and verify country pair.','Code only: LiveMapNoticeStack.tsx','UI extension','Travelers need to know which border is involved.'],
  ['Map notices','Immigration-checkpoint route state','Partial','Critical','Hard','Compare marked crossing with routing geometry.','Code only: LiveMapNoticeStack.tsx','Graphic','Checkpoint guidance must follow the actual route.'],
  ['Map notices','Cross-border route-pending hint','Complete in code','Important','Easy','Check hint before route and during calculation.','Code only: LiveMapNoticeStack.tsx','UI extension','Separates expected checkpoint from one already located.'],
];

const existing = new Set(sheet.getRange('C7:C318').values.flat().map(String));
for (const item of additions) if (existing.has(item[1])) throw Error(`Duplicate: ${item[1]}`);
const rows = additions.map((item, i) => [
  `L${String(313 + i).padStart(3, '0')}`, item[0], item[1], item[2], item[3], item[4], item[5], item[6],
  'See acceptance / next action', item[7], item[8],
]);
table.rows.add(null, rows);
const end = 318 + rows.length;
sheet.getRange('B3').values = [[312 + rows.length]];
for (const [cell, col, status] of [['D3','D','Complete in code'],['F3','D','Partial'],['H3','D','Pending'],['J3','E','Critical']]) {
  sheet.getRange(cell).formulas = [[`=COUNTIF(${col}7:${col}${end},"${status}")`]];
}
sheet.getRange('A2').values = [['Reviewed 25 Sep 2026 · localhost:3000/live · Gap audit and initial navigation fixes. Complete in code does not mean production QA.']];
for (const [col, values] of [['D',['Complete in code','Partial','Pending']],['E',['Critical','Important','Later']],['F',['Easy','Moderate','Hard','Very hard']]]) {
  sheet.getRange(`${col}319:${col}${end}`).dataValidation = { rule: { type: 'list', values } };
}
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(path);
console.log(JSON.stringify({added: rows.length, total: 312 + rows.length, end}));
