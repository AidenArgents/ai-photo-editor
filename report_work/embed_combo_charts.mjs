import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_图表版.xlsx";
const outputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_图表版.xlsx";
const workDir = "D:/Claude-Workspace/ai-photo-editor/report_work";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const chartSheet = workbook.worksheets.getItem("图表");

chartSheet.deleteAllDrawings();
chartSheet.getRange("A2:V2").merge();
chartSheet.getRange("A2").values = [["口径：销售 > 发货时间业绩｜左轴：销量、订单数量（折线）｜右轴：发货金额（柱状）"]];
chartSheet.getRange("A2:V2").format = { fill: "#F1F5F9", font: { color: "#475569" }, horizontalAlignment: "center" };

const placements = [
  ["combo_manager_daily.png", 4],
  ["combo_manager_monthly.png", 25],
  ["combo_site_daily.png", 46],
  ["combo_site_monthly.png", 67],
];
for (const [filename, row] of placements) {
  const base64 = await fs.readFile(workDir + "/" + filename, "base64");
  chartSheet.images.add({
    dataUrl: "data:image/png;base64," + base64,
    anchor: { from: { row, col: 0 }, extent: { widthPx: 1450, heightPx: 345 } },
  });
}

const rendered = await workbook.render({ sheetName: "图表", range: "A1:V88", scale: 1, format: "png" });
await fs.writeFile(workDir + "/charts_final_preview.png", new Uint8Array(await rendered.arrayBuffer()));
for (const [sheetName, range, filename] of [
  ["汇总", "A1:G31", "final_summary.png"],
  ["店长明细", "A1:F25", "final_manager.png"],
  ["站点明细", "A1:F25", "final_site.png"],
  ["图表数据", "A1:H20", "final_chart_data.png"],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(workDir + "/" + filename, new Uint8Array(await image.arrayBuffer()));
}

const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log("ERROR_SCAN", errors.ndjson ?? errors);
const drawingCheck = await workbook.inspect({ kind: "sheet,drawing", maxChars: 3000 });
console.log("DRAWINGS", drawingCheck.ndjson ?? drawingCheck);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const verified = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const verify = await verified.inspect({ kind: "sheet,drawing", maxChars: 3000 });
console.log("VERIFY", verify.ndjson ?? verify);
console.log("OUTPUT", outputPath);
