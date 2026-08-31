import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点.xlsx";
const outputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_图表版.xlsx";
const previewDir = "D:/Claude-Workspace/ai-photo-editor/report_work";

await fs.mkdir(previewDir, { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const chartSheet = workbook.worksheets.add("图表");
const dataSheet = workbook.worksheets.add("图表数据");
const managerLastRow = 2321;
const siteLastRow = 1625;

function styleHeader(range, fill) {
  range.format = {
    fill: fill || "#0F766E",
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  range.format.borders = { preset: "outside", style: "thin", color: fill || "#0F766E" };
}

function writeDailyBlock(headerRow, sourceSheet, sourceLastRow, chartTitle) {
  const firstRow = headerRow + 1;
  const lastRow = firstRow + 231;
  dataSheet.getRange("A" + headerRow + ":E" + headerRow).values = [["日期", "订单数量", "销售数量", "发货金额", "日期值"]];
  styleHeader(dataSheet.getRange("A" + headerRow + ":E" + headerRow));
  dataSheet.getRange("E" + firstRow).formulas = [["='" + sourceSheet + "'!C2"]];
  dataSheet.getRange("E" + firstRow + ":E" + lastRow).fillDown();
  dataSheet.getRange("A" + firstRow).formulas = [["=TEXT($E" + firstRow + ",\"mm-dd\")"]];
  dataSheet.getRange("A" + firstRow + ":A" + lastRow).fillDown();
  dataSheet.getRange("B" + firstRow).formulas = [["=SUMIFS('" + sourceSheet + "'!$D$2:$D$" + sourceLastRow + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",$E" + firstRow + ")"]];
  dataSheet.getRange("B" + firstRow + ":B" + lastRow).fillDown();
  dataSheet.getRange("C" + firstRow).formulas = [["=SUMIFS('" + sourceSheet + "'!$E$2:$E$" + sourceLastRow + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",$E" + firstRow + ")"]];
  dataSheet.getRange("C" + firstRow + ":C" + lastRow).fillDown();
  dataSheet.getRange("D" + firstRow).formulas = [["=SUMIFS('" + sourceSheet + "'!$F$2:$F$" + sourceLastRow + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",$E" + firstRow + ")"]];
  dataSheet.getRange("D" + firstRow + ":D" + lastRow).fillDown();
  dataSheet.getRange("E" + firstRow + ":E" + lastRow).setNumberFormat("yyyy-mm-dd");
  dataSheet.getRange("B" + firstRow + ":C" + lastRow).setNumberFormat("#,##0");
  dataSheet.getRange("D" + firstRow + ":D" + lastRow).setNumberFormat("#,##0.00");
  dataSheet.getRange("F" + headerRow + ":H" + headerRow).merge();
  dataSheet.getRange("F" + headerRow).values = [[chartTitle + "（公式聚合）"]];
  dataSheet.getRange("F" + headerRow + ":H" + headerRow).format = { fill: "#E0F2FE", font: { bold: true, color: "#0C4A6E" } };
  return { firstRow, lastRow };
}

function writeMonthlyBlock(headerRow, sourceSheet, sourceLastRow, chartTitle) {
  const starts = [2, 33, 61, 92, 122, 153, 183, 214];
  const ends = [32, 60, 91, 121, 152, 182, 213, 233];
  const firstRow = headerRow + 1;
  const lastRow = firstRow + 7;
  dataSheet.getRange("A" + headerRow + ":D" + headerRow).values = [["月份", "订单数量", "销售数量", "发货金额"]];
  styleHeader(dataSheet.getRange("A" + headerRow + ":D" + headerRow), "#1D4ED8");
  const formulas = [];
  for (let i = 0; i < starts.length; i++) {
    const sourceStart = starts[i];
    const sourceEnd = ends[i];
    const label = "=TEXT('" + sourceSheet + "'!$C$" + sourceStart + ",\"yyyy-mm\")";
    const orders = "=SUMIFS('" + sourceSheet + "'!$D$2:$D$" + sourceLastRow + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",\">=\"&'" + sourceSheet + "'!$C$" + sourceStart + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",\"<=\"&'" + sourceSheet + "'!$C$" + sourceEnd + ")";
    const sales = "=SUMIFS('" + sourceSheet + "'!$E$2:$E$" + sourceLastRow + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",\">=\"&'" + sourceSheet + "'!$C$" + sourceStart + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",\"<=\"&'" + sourceSheet + "'!$C$" + sourceEnd + ")";
    const amount = "=SUMIFS('" + sourceSheet + "'!$F$2:$F$" + sourceLastRow + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",\">=\"&'" + sourceSheet + "'!$C$" + sourceStart + ",'" + sourceSheet + "'!$C$2:$C$" + sourceLastRow + ",\"<=\"&'" + sourceSheet + "'!$C$" + sourceEnd + ")";
    formulas.push([label, orders, sales, amount]);
  }
  dataSheet.getRange("A" + firstRow + ":D" + lastRow).formulas = formulas;
  dataSheet.getRange("B" + firstRow + ":C" + lastRow).setNumberFormat("#,##0");
  dataSheet.getRange("D" + firstRow + ":D" + lastRow).setNumberFormat("#,##0.00");
  dataSheet.getRange("F" + headerRow + ":H" + headerRow).merge();
  dataSheet.getRange("F" + headerRow).values = [[chartTitle + "（公式聚合）"]];
  dataSheet.getRange("F" + headerRow + ":H" + headerRow).format = { fill: "#DBEAFE", font: { bold: true, color: "#1E3A8A" } };
  return { firstRow, lastRow };
}

dataSheet.showGridLines = false;
const managerDaily = writeDailyBlock(2, "店长明细", managerLastRow, "店长维度每日");
const managerMonthly = writeMonthlyBlock(238, "店长明细", managerLastRow, "店长维度每月");
const siteDaily = writeDailyBlock(250, "站点明细", siteLastRow, "站点维度每日");
const siteMonthly = writeMonthlyBlock(486, "站点明细", siteLastRow, "站点维度每月");
dataSheet.getRange("A1:H1").merge();
dataSheet.getRange("A1").values = [["图表数据（全部由明细页公式聚合）"]];
dataSheet.getRange("A1:H1").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF", fontSize: 14 }, horizontalAlignment: "center" };
dataSheet.getRange("A1:H1").format.rowHeight = 28;
dataSheet.getRange("A1:A493").format.columnWidth = 12;
dataSheet.getRange("B1:C493").format.columnWidth = 14;
dataSheet.getRange("D1:D493").format.columnWidth = 16;
dataSheet.getRange("E1:E493").format.columnWidth = 13;
dataSheet.getRange("F1:H493").format.columnWidth = 16;
dataSheet.freezePanes.freezeRows(2);

chartSheet.showGridLines = false;
chartSheet.getRange("A1:V1").merge();
chartSheet.getRange("A1").values = [["2026年每日销售趋势图｜店长与站点"]];
chartSheet.getRange("A1:V1").format = { fill: "#0F766E", font: { bold: true, color: "#FFFFFF", fontSize: 16 }, horizontalAlignment: "center", verticalAlignment: "center" };
chartSheet.getRange("A1:V1").format.rowHeight = 32;
chartSheet.getRange("A2:V2").merge();
chartSheet.getRange("A2").values = [["口径：销售 > 发货时间业绩｜数量使用折线，发货金额使用柱状；每个面板按相同时间序列呈现。"]];
chartSheet.getRange("A2:V2").format = { fill: "#F1F5F9", font: { color: "#475569" }, horizontalAlignment: "center" };

function sourceFormula(column, firstRow, lastRow) {
  return "'图表数据'!$" + column + "$" + firstRow + ":$" + column + "$" + lastRow;
}

function createCompositePanel(title, row, source) {
  chartSheet.getRange("A" + row + ":V" + row).merge();
  chartSheet.getRange("A" + row).values = [[title]];
  chartSheet.getRange("A" + row + ":V" + row).format = { fill: "#DBEAFE", font: { bold: true, color: "#1E3A8A" } };
  chartSheet.getRange("A" + row + ":V" + row).format.rowHeight = 22;
  const chartTop = row;
  const lineChart = chartSheet.charts.add("line", {
    title: "销量 / 订单数量（折线，数量轴）",
    titleTextStyle: { fontSize: 12, bold: true },
    hasLegend: true,
    legend: { position: "top" },
    from: { row: chartTop, col: 0 },
    extent: { widthPx: 600, heightPx: 260 },
  });
  const salesSeries = lineChart.series.add("销量");
  salesSeries.categoryFormula = sourceFormula("A", source.firstRow, source.lastRow);
  salesSeries.formula = sourceFormula("C", source.firstRow, source.lastRow);
  salesSeries.fill = "#0F766E";
  const orderSeries = lineChart.series.add("订单数量");
  orderSeries.categoryFormula = sourceFormula("A", source.firstRow, source.lastRow);
  orderSeries.formula = sourceFormula("B", source.firstRow, source.lastRow);
  orderSeries.fill = "#F97316";
  lineChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 8 } };
  lineChart.yAxis = { numberFormatCode: "#,##0", textStyle: { fontSize: 9 } };

  const amountChart = chartSheet.charts.add("bar", {
    title: "发货金额（柱状，金额轴）",
    titleTextStyle: { fontSize: 12, bold: true },
    hasLegend: false,
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 45 },
    from: { row: chartTop, col: 12 },
    extent: { widthPx: 500, heightPx: 260 },
  });
  const amountSeries = amountChart.series.add("发货金额");
  amountSeries.categoryFormula = sourceFormula("A", source.firstRow, source.lastRow);
  amountSeries.formula = sourceFormula("D", source.firstRow, source.lastRow);
  amountSeries.fill = "#60A5FA";
  amountChart.xAxis = { axisType: "textAxis", textStyle: { fontSize: 8 } };
  amountChart.yAxis = { numberFormatCode: "#,##0.00", textStyle: { fontSize: 9 } };
}

createCompositePanel("店长维度｜按天（密集）", 4, managerDaily);
createCompositePanel("店长维度｜按月综合", 25, managerMonthly);
createCompositePanel("站点维度｜按天（密集）", 46, siteDaily);
createCompositePanel("站点维度｜按月综合", 67, siteMonthly);

const chartPreview = await workbook.render({ sheetName: "图表", range: "A1:V88", scale: 1, format: "png" });
await fs.writeFile(previewDir + "/charts_preview.png", new Uint8Array(await chartPreview.arrayBuffer()));
for (const [sheetName, range, filename] of [
  ["汇总", "A1:G31", "after_summary.png"],
  ["店长明细", "A1:F25", "after_manager.png"],
  ["站点明细", "A1:F25", "after_site.png"],
  ["图表数据", "A1:H20", "chart_data_preview.png"],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(previewDir + "/" + filename, new Uint8Array(await image.arrayBuffer()));
}

const check = await workbook.inspect({ kind: "sheet,table,drawing,formula", maxChars: 6500, tableMaxRows: 3, tableMaxCols: 7, tableMaxCellChars: 80 });
console.log("CHECK", check.ndjson ?? check);
const formulaErrors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "formula error scan" });
console.log("ERROR_SCAN", formulaErrors.ndjson ?? formulaErrors);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const verified = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const verify = await verified.inspect({ kind: "sheet,table,drawing", maxChars: 3500, tableMaxRows: 2, tableMaxCols: 6 });
console.log("VERIFY", verify.ndjson ?? verify);
console.log("OUTPUT", outputPath);
