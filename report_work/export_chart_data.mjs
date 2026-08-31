import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点.xlsx";
const outputPath = "D:/Claude-Workspace/ai-photo-editor/report_work/chart_series.json";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

function serialToDate(serial) {
  const milliseconds = (Number(serial) - 25569) * 86400 * 1000;
  return new Date(milliseconds).toISOString().slice(0, 10);
}
function aggregate(sheetName, lastRow) {
  const values = workbook.worksheets.getItem(sheetName).getRange("C2:F" + lastRow).values;
  const byDate = new Map();
  for (const [dateSerial, orders, sales, amount] of values) {
    const date = serialToDate(dateSerial);
    const current = byDate.get(date) || { date, orders: 0, sales: 0, amount: 0 };
    current.orders += Number(orders) || 0;
    current.sales += Number(sales) || 0;
    current.amount += Number(amount) || 0;
    byDate.set(date, current);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
function byMonth(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const current = grouped.get(month) || { date: month + "-01", label: month, orders: 0, sales: 0, amount: 0 };
    current.orders += row.orders;
    current.sales += row.sales;
    current.amount += row.amount;
    grouped.set(month, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

const managerDaily = aggregate("店长明细", 2321);
const siteDaily = aggregate("站点明细", 1625);
const payload = {
  managerDaily,
  managerMonthly: byMonth(managerDaily),
  siteDaily,
  siteMonthly: byMonth(siteDaily),
};
await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
console.log(JSON.stringify({ outputPath, managerDaily: managerDaily.length, siteDaily: siteDaily.length, managerMonthly: payload.managerMonthly.length, siteMonthly: payload.siteMonthly.length }));
