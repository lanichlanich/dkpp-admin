import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import ExcelJS from "exceljs";
import ts from "typescript";

const require = createRequire(import.meta.url), cache = new Map();
function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only") return {};
    if (name === "@/lib/database") return { database: { prepare() { throw Error("Export must use supplied entries, not query the database"); } } };
    if (name.endsWith(".json")) return require(path.resolve(name.replace(/^@\//, "src/")));
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  mod._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText, filename);
  return mod.exports;
}

const { createScheduleExcel } = load("src/lib/wfh-schedule-export.ts");
const { fridayDates } = load("src/lib/wfh-schedule.ts");
for (const [period, count] of [["2026-11", 2], ["2026-10", 64], ["2027-02", 0]]) {
  const dates = fridayDates(period), endColumn = 5 + dates.length;
  const entries = Array.from({ length: count }, (_, index) => dates.map((fridayDate, dateIndex) => ({
    period, employeeNip: String(199001012020121001n + BigInt(index)), employeeName: `Pegawai & Uji ${index + 1}`,
    position: "Pengadministrasi Perkantoran", unit: "Dinas Ketahanan Pangan dan Pertanian", sortOrder: index,
    fridayDate, status: (index + dateIndex) % 2 === 0 ? "WFH" : "WFO",
  }))).flat();
  const snapshot = structuredClone(entries), workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await createScheduleExcel(period, entries));
  assert.deepEqual(entries, snapshot, "Formatting must not change source roster/statuses");
  const sheet = workbook.worksheets[0];
  assert.deepEqual(sheet.columns.map(column => column.width), [3.85546875, 36.42578125, 19.5703125, 55.85546875, 62.7109375, ...dates.map(() => 12.7109375), 27, 7]);
  assert.equal(sheet.properties.defaultRowHeight, 15);
  assert.equal(sheet.getRow(1).height, 24.95); assert.equal(sheet.getRow(2).height, 24.95);
  for (let row = 3; row <= count + 5; row++) assert.equal(sheet.getRow(row).height, 15);
  assert.equal(sheet.getCell("A1").fill.fgColor.argb, "FFE8E8E8");
  assert.equal(sheet.getCell("F2").fill.fgColor.argb, "FFE8E8E8");
  assert.equal(sheet.getCell("A1").font.name, "Aptos Narrow");
  assert.equal(sheet.getCell("F2").font.name, "Arial");
  assert.equal(sheet.getCell("F2").numFmt, "mm-dd-yy", "Built-in localized short-date format from reference");
  assert.equal(sheet.getCell(1, endColumn + 1).value, "Work From Home (WFH)");
  assert.equal(sheet.getCell(2, endColumn + 2).value, "✖");
  assert.equal(sheet.getCell("A2").master.address, "A1");
  assert.equal(sheet.getCell(1, endColumn).master.address, "F1");
  assert.equal(sheet.views[0].xSplit, 5); assert.equal(sheet.views[0].ySplit, 3);
  assert.equal(sheet.getCell(count + 4, 2).value, "Jumlah WFH");
  assert.equal(sheet.getCell(count + 5, 2).value, "Jumlah WFO");
  for (const [index, date] of dates.entries()) {
    assert.equal(sheet.getCell(2, 6 + index).value.toISOString().slice(0, 10), date);
    const wfh = entries.filter(entry => entry.fridayDate === date && entry.status === "WFH").length;
    assert.equal(sheet.getCell(count + 4, 6 + index).value, wfh);
    assert.equal(sheet.getCell(count + 5, 6 + index).value, count - wfh);
  }
  if (!count) { assert.equal(sheet.conditionalFormattings.length, 0); continue; }
  for (let row = 4; row <= count + 3; row++) {
    assert.equal(sheet.getCell(row, 3).value, entries[(row - 4) * dates.length].employeeNip);
    assert.equal(sheet.getCell(row, 3).numFmt, "@");
    assert.equal(sheet.getCell(row, 2).font.name, "Aptos Narrow");
    assert.equal(sheet.getCell(row, 2).font.size, 11);
    assert.equal(sheet.getCell(row, 2).fill.pattern, "none", "No alternating fills on employee rows");
    assert(!sheet.getCell(row, 2).alignment?.wrapText);
    for (let column = 6; column <= endColumn; column++) {
      const cell = sheet.getCell(row, column), expected = entries[(row - 4) * dates.length + column - 6].status;
      assert.equal(cell.value, expected === "WFH" ? "✓" : "✖");
      assert.equal(cell.font.name, "Arial"); assert.equal(cell.font.size, 11); assert(!cell.font.bold);
      assert.notEqual(cell.alignment?.horizontal, "center");
      for (const side of ["top", "bottom", "left", "right"]) assert.equal(cell.border[side].color.argb, "FF000000");
    }
  }
  const [formatting] = sheet.conditionalFormattings;
  assert.equal(formatting.ref, `F4:${sheet.getColumn(endColumn).letter}${count + 3}`);
  assert.equal(formatting.rules.length, 2);
  for (const [symbol, fill, font] of [["✖", "FFFFC7CE", "FF9C0006"], ["✓", "FFC6EFCE", "FF006100"]]) {
    const rule = formatting.rules.find(rule => rule.formulae?.some(formula => formula.includes(symbol)));
    assert.equal(rule.type, "expression"); assert.equal(rule.style.fill.fgColor.argb, fill);
    assert.equal(rule.style.fill.bgColor.argb, fill, "Native Excel needs the differential background color");
    assert.equal(rule.style.font.color.argb, font);
  }
}
console.log("PASS monthly WFH/WFO Excel: reference dimensions, heights, fonts, borders, localized dates, editable green/red status formatting, 4/5 Fridays, 18-digit NIP, live data/totals and empty roster.");
