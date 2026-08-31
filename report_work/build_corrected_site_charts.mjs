import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点.xlsx";
const siteDataPath = "D:/Claude-Workspace/ai-photo-editor/report_work/site_director_data.json";
const outputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_按人员站点图表版.xlsx";
const previewDir = "D:/Claude-Workspace/ai-photo-editor/report_work";

const managers = ["王云", "樊永鹏", "侯兴华", "张垒", "李雪雪", "朱春雨", "吴承龙", "叶娜", "徐跃男", "许炎"];
const sites = ["印度尼西亚", "菲律宾", "越南", "马来西亚", "泰国", "墨西哥", "巴西"];
const baseColors = ["#0F766E", "#2563EB", "#D97706", "#9333EA", "#DC2626", "#0891B2", "#65A30D", "#DB2777", "#475569", "#EA580C"];
const lightColors = ["#7DD3C7", "#93C5FD", "#FCD34D", "#D8B4FE", "#FCA5A5", "#67E8F9", "#BEF264", "#F9A8D4", "#CBD5E1", "#FDBA74"];

const source = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(source);
const siteData = JSON.parse(await fs.readFile(siteDataPath, "utf8"));
await fs.mkdir(previewDir, { recursive: true });

for (const site of sites) {
  if (!Array.isArray(siteData[site]) || siteData[site].length !== 232) {
    throw new Error(`${site} 缺少完整的 232 天数据`);
  }
}

const managerSheet = workbook.worksheets.getItem("店长明细");
const siteSheet = workbook.worksheets.getItem("站点明细");
const summarySheet = workbook.worksheets.getItem("汇总");
const managerLastRow = 2321;
const siteLastRow = 1625;

function colLetter(n) {
  let value = n;
  let out = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
}

function excelSerial(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000);
}

function styleHeader(range, fill = "#0F766E") {
  range.format = {
    fill,
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  range.format.borders = { preset: "outside", style: "thin", color: fill };
}

function writeHelperBlock({ topRow, kind, entities, sourceSheet, sourceLastRow }) {
  const isDaily = kind === "daily";
  const label = sourceSheet === "店长明细" ? "店长" : "站点";
  const title = `${label}维度｜${isDaily ? "按天（密集）" : "按月综合"}｜公式图表数据`;
  const headerRow = topRow + 1;
  const firstRow = topRow + 2;
  const points = isDaily ? 232 : 8;
  const lastRow = firstRow + points - 1;
  const amountStart = 3 + entities.length * 2;
  const lastCol = colLetter(amountStart + entities.length - 1);

  dataSheet.getRange(`A${topRow}:${lastCol}${topRow}`).merge();
  dataSheet.getRange(`A${topRow}`).values = [[title]];
  dataSheet.getRange(`A${topRow}:${lastCol}${topRow}`).format = {
    fill: isDaily ? "#0F766E" : "#1D4ED8",
    font: { bold: true, color: "#FFFFFF", fontSize: 12 },
    horizontalAlignment: "left",
    verticalAlignment: "center",
  };
  dataSheet.getRange(`A${topRow}:${lastCol}${topRow}`).format.rowHeight = 24;

  const headers = ["时间标签", "时间值"];
  for (const entity of entities) headers.push(`${entity}_销量`, `${entity}_订单`);
  for (const entity of entities) headers.push(`${entity}_发货金额`);
  dataSheet.getRange(`A${headerRow}:${lastCol}${headerRow}`).values = [headers];
  styleHeader(dataSheet.getRange(`A${headerRow}:${lastCol}${headerRow}`), isDaily ? "#134E4A" : "#1E3A8A");
  dataSheet.getRange(`A${headerRow}:${lastCol}${headerRow}`).format.rowHeight = 34;

  if (isDaily) {
    dataSheet.getRange(`B${firstRow}`).formulas = [[`='${sourceSheet}'!$C2`]];
    dataSheet.getRange(`B${firstRow}:B${lastRow}`).fillDown();
  } else {
    dataSheet.getRange(`B${firstRow}:B${lastRow}`).values = Array.from({ length: 8 }, (_, i) => [excelSerial(`2026-${String(i + 1).padStart(2, "0")}-01`)]);
  }
  dataSheet.getRange(`A${firstRow}`).formulas = [[`=TEXT($B${firstRow},"${isDaily ? "mm-dd" : "yyyy-mm"}")`]];
  dataSheet.getRange(`A${firstRow}:A${lastRow}`).fillDown();

  const monthOffsets = [0, 31, 59, 90, 120, 151, 181, 212];
  const monthLengths = [31, 28, 31, 30, 31, 30, 31, 20];
  entities.forEach((entity, index) => {
    const salesCol = colLetter(3 + index * 2);
    const ordersCol = colLetter(4 + index * 2);
    const amountCol = colLetter(amountStart + index);
    const sourceFirstRow = 2 + index * 232;
    if (isDaily) {
      dataSheet.getRange(`${salesCol}${firstRow}`).formulas = [[`='${sourceSheet}'!$E${sourceFirstRow}`]];
      dataSheet.getRange(`${salesCol}${firstRow}:${salesCol}${lastRow}`).fillDown();
      dataSheet.getRange(`${ordersCol}${firstRow}`).formulas = [[`='${sourceSheet}'!$D${sourceFirstRow}`]];
      dataSheet.getRange(`${ordersCol}${firstRow}:${ordersCol}${lastRow}`).fillDown();
      dataSheet.getRange(`${amountCol}${firstRow}`).formulas = [[`='${sourceSheet}'!$F${sourceFirstRow}`]];
      dataSheet.getRange(`${amountCol}${firstRow}:${amountCol}${lastRow}`).fillDown();
    } else {
      const sumFormula = (metricCol, monthIndex) => {
        const start = sourceFirstRow + monthOffsets[monthIndex];
        const end = start + monthLengths[monthIndex] - 1;
        return `=SUM('${sourceSheet}'!$${metricCol}$${start}:$${metricCol}$${end})`;
      };
      dataSheet.getRange(`${salesCol}${firstRow}:${salesCol}${lastRow}`).formulas = monthOffsets.map((_, i) => [sumFormula("E", i)]);
      dataSheet.getRange(`${ordersCol}${firstRow}:${ordersCol}${lastRow}`).formulas = monthOffsets.map((_, i) => [sumFormula("D", i)]);
      dataSheet.getRange(`${amountCol}${firstRow}:${amountCol}${lastRow}`).formulas = monthOffsets.map((_, i) => [sumFormula("F", i)]);
    }
  });

  dataSheet.getRange(`B${firstRow}:B${lastRow}`).setNumberFormat("yyyy-mm-dd");
  dataSheet.getRange(`C${firstRow}:${colLetter(amountStart - 1)}${lastRow}`).setNumberFormat("#,##0");
  dataSheet.getRange(`${colLetter(amountStart)}${firstRow}:${lastCol}${lastRow}`).setNumberFormat("#,##0.00");
  return { firstRow, lastRow, entities, amountStart, lastCol };
}

// Correct the site detail source with the pages filtered to directors 王云 and 许炎.
const siteRows = [];
for (const site of sites) {
  for (const [date, orders, sales, amount] of siteData[site]) {
    siteRows.push(["站点", site, excelSerial(date), orders, sales, amount]);
  }
}
siteSheet.getRange("A2:F1625").values = siteRows;
siteSheet.getRange("C2:C1625").setNumberFormat("yyyy-mm-dd");
siteSheet.getRange("D2:E1625").setNumberFormat("#,##0");
siteSheet.getRange("F2:F1625").setNumberFormat("#,##0.00");
siteSheet.getRange("H1:I1").values = [["站点数据范围", "总监：王云、许炎"]];
siteSheet.getRange("H1:I1").format = { fill: "#E0F2FE", font: { bold: true, color: "#0C4A6E" } };
siteSheet.getRange("H1:I1").format.columnWidth = 18;

summarySheet.getRange("C5:D5").values = [["末日", excelSerial("2026-08-20")]];
summarySheet.getRange("D5").setNumberFormat("yyyy-mm-dd");
summarySheet.getRange("A6:G6").merge();
summarySheet.getRange("A6").values = [["站点口径：总监 = 王云、许炎；发货时间业绩。"]];
summarySheet.getRange("A6:G6").format = { fill: "#E0F2FE", font: { color: "#0C4A6E", bold: true }, horizontalAlignment: "left", verticalAlignment: "center" };
summarySheet.getRange("A6:G6").format.rowHeight = 22;

for (const name of ["图表", "图表数据"]) {
  try {
    const sheet = workbook.worksheets.getItem(name);
    sheet.deleteAllDrawings();
    sheet.getUsedRange().clear({ applyTo: "all" });
  } catch {}
}
try { workbook.worksheets.getItem("图表"); } catch { workbook.worksheets.add("图表"); }
try { workbook.worksheets.getItem("图表数据"); } catch { workbook.worksheets.add("图表数据"); }
const chartSheet = workbook.worksheets.getItem("图表");
const dataSheet = workbook.worksheets.getItem("图表数据");

dataSheet.showGridLines = false;
dataSheet.getRange("A1:AF1").merge();
dataSheet.getRange("A1").values = [["图表数据｜明细页公式聚合，可随数据更新"]];
dataSheet.getRange("A1:AF1").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF", fontSize: 14 }, horizontalAlignment: "center" };
dataSheet.getRange("A1:AF1").format.rowHeight = 28;
dataSheet.getRange("A1:AF500").format.columnWidth = 12;
dataSheet.getRange("B1:B500").format.columnWidth = 13;
const managerDaily = writeHelperBlock({ topRow: 3, kind: "daily", entities: managers, sourceSheet: "店长明细", sourceLastRow: managerLastRow });
const managerMonthly = writeHelperBlock({ topRow: 240, kind: "monthly", entities: managers, sourceSheet: "店长明细", sourceLastRow: managerLastRow });
const siteDaily = writeHelperBlock({ topRow: 253, kind: "daily", entities: sites, sourceSheet: "站点明细", sourceLastRow: siteLastRow });
const siteMonthly = writeHelperBlock({ topRow: 490, kind: "monthly", entities: sites, sourceSheet: "站点明细", sourceLastRow: siteLastRow });
dataSheet.freezePanes.freezeRows(4);

function formulaFor(column, firstRow, lastRow) {
  return `'图表数据'!$${column}$${firstRow}:$${column}$${lastRow}`;
}

function addLineChart(title, source, left, right) {
  const chart = chartSheet.charts.add("line", { title, hasLegend: false });
  source.entities.forEach((entity, index) => {
    const sales = chart.series.add(`${entity} 销量`);
    sales.categoryFormula = formulaFor("A", source.firstRow, source.lastRow);
    sales.formula = formulaFor(colLetter(3 + index * 2), source.firstRow, source.lastRow);
    sales.fill = baseColors[index];
    const orders = chart.series.add(`${entity} 订单`);
    orders.categoryFormula = formulaFor("A", source.firstRow, source.lastRow);
    orders.formula = formulaFor(colLetter(4 + index * 2), source.firstRow, source.lastRow);
    orders.fill = lightColors[index];
  });
  chart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 7 } };
  chart.yAxis = { numberFormatCode: "#,##0", textStyle: { fontSize: 9 } };
  chart.titleTextStyle.fontSize = 12;
  chart.setPosition(left, right);
}

function addAmountChart(title, source, left, right) {
  const chart = chartSheet.charts.add("bar", { title, hasLegend: false, barOptions: { direction: "column", grouping: "stacked", gapWidth: 45 } });
  source.entities.forEach((entity, index) => {
    const series = chart.series.add(entity);
    series.categoryFormula = formulaFor("A", source.firstRow, source.lastRow);
    series.formula = formulaFor(colLetter(source.amountStart + index), source.firstRow, source.lastRow);
    series.fill = baseColors[index];
  });
  chart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 7 } };
  chart.yAxis = { numberFormatCode: "#,##0.00", textStyle: { fontSize: 9 }, min: 0 };
  chart.titleTextStyle.fontSize = 12;
  chart.setPosition(left, right);
}

function addColorKey(row, labels) {
  const width = 3;
  labels.forEach((name, i) => {
    const start = 1 + i * width;
    const colorCell = `${colLetter(start)}${row}`;
    const labelStart = `${colLetter(start + 1)}${row}`;
    const labelEnd = `${colLetter(start + width - 1)}${row}`;
    chartSheet.getRange(`${labelStart}:${labelEnd}`).merge();
    chartSheet.getRange(colorCell).values = [[" "]];
    chartSheet.getRange(colorCell).format = { fill: baseColors[i], borders: { preset: "outside", style: "thin", color: "#FFFFFF" } };
    chartSheet.getRange(`${labelStart}:${labelEnd}`).values = [[name]];
    chartSheet.getRange(`${labelStart}:${labelEnd}`).format = { font: { color: "#334155", bold: true }, horizontalAlignment: "left" };
  });
}

function addPanel(row, title, source) {
  chartSheet.getRange(`A${row}:AG${row}`).merge();
  chartSheet.getRange(`A${row}`).values = [[title]];
  chartSheet.getRange(`A${row}:AG${row}`).format = { fill: "#DBEAFE", font: { bold: true, color: "#1E3A8A", fontSize: 12 } };
  chartSheet.getRange(`A${row}:AG${row}`).format.rowHeight = 23;
  const keyRow = row + 1;
  chartSheet.getRange(`A${keyRow}:AG${keyRow}`).format.rowHeight = 20;
  addColorKey(keyRow, source.entities);
  const chartRow = row + 2;
  addLineChart("销量 / 单量趋势（深色=销量；浅色=订单）", source, `A${chartRow}`, `Q${chartRow + 16}`);
  addAmountChart("发货金额（与实体颜色对应）", source, `S${chartRow}`, `AG${chartRow + 16}`);
}

chartSheet.showGridLines = false;
chartSheet.getRange("A1:AG1").merge();
chartSheet.getRange("A1").values = [["2026 年销售趋势｜店长与站点"]];
chartSheet.getRange("A1:AG1").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF", fontSize: 16 }, horizontalAlignment: "center", verticalAlignment: "center" };
chartSheet.getRange("A1:AG1").format.rowHeight = 32;
chartSheet.getRange("A2:AG2").merge();
chartSheet.getRange("A2").values = [["口径：发货时间业绩。每个面板左侧为多条销量/订单折线，右侧为同色系发货金额柱状；站点仅统计总监王云、许炎范围。"]];
chartSheet.getRange("A2:AG2").format = { fill: "#F1F5F9", font: { color: "#475569" }, horizontalAlignment: "center", wrapText: true };
chartSheet.getRange("A1:AG86").format.columnWidth = 9;
addPanel(4, "店长维度｜按天（密集）", managerDaily);
addPanel(25, "店长维度｜按月综合", managerMonthly);
addPanel(46, "站点维度｜按天（密集）", siteDaily);
addPanel(67, "站点维度｜按月综合", siteMonthly);

const summaryCheck = await workbook.inspect({ kind: "table", range: "汇总!A23:G31", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 7, maxChars: 6000 });
console.log("SUMMARY_CHECK", summaryCheck.ndjson);
const sourceCheck = await workbook.inspect({ kind: "table", range: "站点明细!A1:F10", include: "values,formulas", tableMaxRows: 10, tableMaxCols: 6, maxChars: 6000 });
console.log("SITE_CHECK", sourceCheck.ndjson);
const drawingCheck = await workbook.inspect({ kind: "drawing", maxChars: 6000 });
console.log("DRAWINGS", drawingCheck.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 200 }, summary: "final formula error scan" });
console.log("ERROR_SCAN", errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT ${outputPath}`);
