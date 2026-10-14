import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const data = JSON.parse(readFileSync("src/data/pns-salary-2024.json", "utf8"));
const source = readFileSync("src/lib/pns-payroll.ts", "utf8");
const module = { exports: {} };
new Function("require", "exports", ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)(() => data, module.exports);
const { calculatePnsPayroll: calculate, DEFAULT_PNS_PAYROLL: defaults, salaryYears } = module.exports;
const run = overrides => calculate({ ...defaults, ...overrides });
const amount = (rows, name) => rows.find(row => row.name === name)?.amount;

// Independent examples calculated from the public salary/allowance schedules.
let result = run({});
assert.equal(result.basic, 2_785_700);
assert.equal(result.gross, 3_043_120);
assert.equal(result.totalDeductions, 252_563);
assert.equal(result.net, 2_790_557);
result = run({ spouse: true, children: 2 });
assert.equal(result.familyBase, 3_175_698);
assert.equal(result.gross, 3_650_378);
assert.equal(result.totalDeductions, 287_663);
assert.equal(result.net, 3_362_715);
assert.equal(amount(result.deductions, "Iuran pensiun"), 150_846);
assert.equal(amount(result.deductions, "Tabungan Hari Tua (THT)"), 103_210);
assert.equal(result.net - run({ spouse: true, children: 2, korpri: true }).net, 100_000);
result = run({ spouse: true, children: 2, job: "struktural", echelon: "II A", functionalAllowance: 9_000_000 });
assert.equal(result.gross, 6_715_378);
assert.equal(result.net, 6_397_065);
assert.equal(amount(result.income, "Tunjangan umum"), undefined);
assert.equal(amount(result.income, "Tunjangan fungsional"), undefined);
result = run({ job: "fungsional", functionalAllowance: 1_000_000 });
assert.equal(result.gross, 3_858_120);
assert.equal(result.bpjsBase, 3_785_700);
assert.equal(run({ job: "tanpa" }).gross, 2_858_120);
assert.equal(run({ months: 11 }).basic, 2_785_700);
assert.equal(run({ years: 1 }).basic, 2_785_700);
assert.equal(run({ years: 2 }).basic, 2_873_500);
assert.equal(run({ grade: "I/a", years: 0 }).basic, 1_685_700);
assert.equal(run({ grade: "IV/e", years: 32 }).basic, 6_373_200);
for (const [grade, expected] of Object.entries({ "II/a": 3_643_400, "II/b": 3_797_500, "II/c": 3_958_200, "II/d": 4_125_600 })) {
  assert.equal(run({ grade, years: 33 }).basic, expected);
  assert(salaryYears(grade).includes(33));
}
for (const [grade, entries] of Object.entries(data.salaries)) for (const [years, basic] of Object.entries(entries)) {
  const result = run({ grade, years: Number(years), spouse: true, children: 2 });
  assert.equal(result.basic, basic);
  assert.equal(result.gross - result.totalDeductions, result.net);
}
const baseline = run({});
result = run({ bpjsBaseOverride: 25_000_000, additionalBpjsMembers: 2 });
assert.equal(result.bpjsBase, 12_000_000);
assert.equal(amount(result.deductions, "BPJS Kesehatan pegawai"), 120_000);
assert.equal(amount(result.deductions, "BPJS keluarga tambahan"), 240_000);
assert.equal(result.gross, baseline.gross); // The override never adds TPP to income.
result = run({ professionalAllowance: 500_000, mealDays: 20, mealRate: 37_000, allowances: [{ name: "Risiko", amount: 50_000, bpjsBase: false }, { name: "Tunjangan khusus", amount: 25_000, bpjsBase: true }] });
assert.equal(result.bpjsBase, baseline.bpjsBase + 525_000);
assert.equal(result.gross, baseline.gross + 1_315_000);
assert.equal(amount(result.deductions, "Iuran pensiun"), amount(baseline.deductions, "Iuran pensiun"));
assert.equal(run({ riceInCash: false }).gross, baseline.gross - 72_420);
assert.equal(run({ tapera: 70_000, cashTax: 30_000, deductions: [{ name: "Koperasi", amount: 50_000 }] }).net, baseline.net - 150_000);
assert.equal(run({ rounding: 43 }).net, baseline.net + 43);
assert(run({ deductions: [{ name: "Cicilan", amount: 9_000_000 }] }).net < 0);
for (const invalid of [{ grade: "V/a" }, { grade: "I/b", years: 0 }, { years: 34 }, { years: 0.5 }, { months: 12 }, { children: 3 }, { mealDays: 32 }, { mealRate: NaN }, { functionalAllowance: -1 }, { tapera: Infinity }, { bpjsBaseOverride: 0 }, { job: "struktural", echelon: "invalid" }, { allowances: [{ name: "", amount: 1 }] }, { allowances: [{ name: "Tunjangan kinerja", amount: 1 }] }, { deductions: [{ name: "Koperasi", amount: -1 }] }]) assert.throws(() => run(invalid));
assert.match(readFileSync("src/app/dashboard/simulasi-gaji-pns/page.tsx", "utf8"), /await requireMenuAccess\("simulasi-gaji-pns"\)/);
assert.match(readFileSync("src/lib/access-control.ts", "utf8"), /id: "simulasi-gaji-pns".*group: "Keuangan"/);
console.log(`PNS payroll passed: ${Object.values(data.salaries).reduce((n, rows) => n + Object.keys(rows).length, 0)} salary rows, independent monthly examples, allowances, deduction bases/caps, KORPRI and invalid inputs.`);
