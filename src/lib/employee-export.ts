import "server-only";

import ExcelJS from "exceljs";
import type { Employee } from "@/lib/db-types";

export async function createEmployeeExcel(employees: Employee[], today: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DKPP-Admin";
  const columns = [
    { header: "No", width: 7 },
    { header: "NIP", width: 24 },
    { header: "Nama", width: 36 },
    { header: "Tempat lahir", width: 22 },
    { header: "Jenis kelamin", width: 18 },
    { header: "Unor induk", width: 42 },
    { header: "Unit organisasi", width: 42 },
    { header: "Jabatan", width: 54 },
    { header: "Jenis jabatan", width: 20 },
    { header: "Eselon", width: 13 },
    { header: "Golongan / pangkat", width: 25 },
    { header: "BUP (tahun)", width: 15 },
    { header: "Jenis ASN", width: 16 },
    { header: "Status", width: 15 },
  ];
  const sheet = workbook.addWorksheet("Daftar Pegawai", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:3" },
  });
  columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width; });
  sheet.getColumn(2).numFmt = "@";
  sheet.mergeCells(1, 1, 1, columns.length);
  sheet.mergeCells(2, 1, 2, columns.length);
  sheet.getCell("A1").value = "DAFTAR PEGAWAI";
  sheet.getCell("A2").value = `DKPP Kabupaten Indramayu | ${today} | ${employees.length} pegawai`;
  sheet.getRow(1).height = 32;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).values = columns.map(column => column.header);
  sheet.getRow(3).height = 30;

  employees.forEach((employee, index) => {
    const values = [index + 1, employee.nip, employee.name, employee.birthPlace, employee.gender, employee.parentUnit,
      employee.unit, employee.position, employee.positionType, employee.echelon, employee.rank, employee.retirementAge,
      employee.asnType, employee.status];
    const row = sheet.addRow(values);
    const lines = values.map((value, column) => String(value ?? "").split(/\r?\n/)
      .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (columns[column].width * 0.8))), 0));
    row.height = Math.max(28, Math.max(...lines) * 15 + 8);
  });
  sheet.eachRow((row, index) => {
    row.font = { name: "Calibri", size: 11, color: { argb: "FF172D25" } };
    row.alignment = { vertical: "middle", wrapText: true };
    if (index === 1 || index === 3) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
      row.font = { name: "Calibri", size: index === 1 ? 16 : 11, bold: true, color: { argb: "FFFFFFFF" } };
    } else if (index % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F7F4" } };
    }
  });
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: sheet.rowCount, column: columns.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
