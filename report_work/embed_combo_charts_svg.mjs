import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_图表版.xlsx";
const outputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_图表版.xlsx";
const workDir = "D:/Claude-Workspace/ai-photo-editor/report_work";
const series = JSON.parse(await fs.readFile(workDir + "/chart_series.json", "utf8"));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const chartSheet = workbook.worksheets.getItem("图表");

function esc(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function compactNumber(value) {
  return Math.round(value).toLocaleString("en-US");
}
function svgChart(rows, title, dense) {
  const width = 1450;
  const height = 345;
  const left = 92;
  const right = 1325;
  const top = 42;
  const bottom = 282;
  const plotW = right - left;
  const plotH = bottom - top;
  const count = rows.length;
  const maxQty = Math.max(1, ...rows.map(r => Math.max(r.sales, r.orders))) * 1.12;
  const maxAmt = Math.max(1, ...rows.map(r => r.amount)) * 1.12;
  const x = i => left + (count === 1 ? plotW / 2 : (i * plotW) / (count - 1));
  const yQty = v => bottom - (v / maxQty) * plotH;
  const yAmt = v => bottom - (v / maxAmt) * plotH;
  const ticks = 5;
  let grid = "";
  for (let i = 0; i <= ticks; i++) {
    const yy = bottom - (i * plotH) / ticks;
    const qty = (maxQty * i) / ticks;
    const amt = (maxAmt * i) / ticks;
    grid += '<line x1="' + left + '" y1="' + yy + '" x2="' + right + '" y2="' + yy + '" stroke="#CBD5E1" stroke-dasharray="4 4" stroke-width="1"/>';
    grid += '<text x="' + (left - 12) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11" fill="#475569">' + compactNumber(qty) + '</text>';
    grid += '<text x="' + (right + 12) + '" y="' + (yy + 4) + '" font-size="11" fill="#2563EB">' + compactNumber(amt) + '</text>';
  }
  const maxLabels = dense ? 12 : count;
  const labelStep = Math.max(1, Math.ceil(count / maxLabels));
  let labels = "";
  for (let i = 0; i < count; i += labelStep) {
    const label = dense ? rows[i].date.slice(5) : rows[i].label;
    labels += '<text x="' + x(i) + '" y="' + (bottom + 22) + '" text-anchor="middle" font-size="10" fill="#64748B">' + esc(label) + '</text>';
  }
  if ((count - 1) % labelStep !== 0) {
    const last = rows[count - 1];
    labels += '<text x="' + x(count - 1) + '" y="' + (bottom + 22) + '" text-anchor="middle" font-size="10" fill="#64748B">' + esc(dense ? last.date.slice(5) : last.label) + '</text>';
  }
  const barW = Math.max(1.5, (plotW / Math.max(count, 1)) * (dense ? 0.7 : 0.48));
  let bars = "";
  for (let i = 0; i < count; i++) {
    const yy = yAmt(rows[i].amount);
    bars += '<rect x="' + (x(i) - barW / 2) + '" y="' + yy + '" width="' + barW + '" height="' + (bottom - yy) + '" fill="#93C5FD" opacity="0.74"/>';
  }
  const salesPoints = rows.map((r, i) => x(i) + ',' + yQty(r.sales)).join(' ');
  const orderPoints = rows.map((r, i) => x(i) + ',' + yQty(r.orders)).join(' ');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">' +
    '<rect width="100%" height="100%" fill="#FFFFFF"/>' +
    '<text x="' + left + '" y="20" font-family="Microsoft YaHei, SimHei, sans-serif" font-size="16" font-weight="700" fill="#0F172A">' + esc(title) + '</text>' +
    '<rect x="' + (right - 350) + '" y="8" width="14" height="10" fill="#0F766E"/><text x="' + (right - 330) + '" y="18" font-size="11" fill="#334155">销量</text>' +
    '<rect x="' + (right - 260) + '" y="8" width="14" height="10" fill="#F97316"/><text x="' + (right - 240) + '" y="18" font-size="11" fill="#334155">订单数量</text>' +
    '<rect x="' + (right - 130) + '" y="8" width="14" height="10" fill="#93C5FD"/><text x="' + (right - 110) + '" y="18" font-size="11" fill="#334155">发货金额</text>' +
    grid +
    '<line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + bottom + '" stroke="#94A3B8"/><line x1="' + right + '" y1="' + top + '" x2="' + right + '" y2="' + bottom + '" stroke="#94A3B8"/><line x1="' + left + '" y1="' + bottom + '" x2="' + right + '" y2="' + bottom + '" stroke="#94A3B8"/>' +
    bars +
    '<polyline fill="none" stroke="#0F766E" stroke-width="2.5" points="' + salesPoints + '"/><polyline fill="none" stroke="#F97316" stroke-width="2.2" points="' + orderPoints + '"/>' +
    labels +
    '<text x="22" y="' + (top + plotH / 2) + '" transform="rotate(-90 22 ' + (top + plotH / 2) + ')" font-size="12" fill="#334155">数量</text>' +
    '<text x="' + (width - 15) + '" y="' + (top + plotH / 2) + '" transform="rotate(-90 ' + (width - 15) + ' ' + (top + plotH / 2) + ')" font-size="12" fill="#2563EB">发货金额</text>' +
    '</svg>';
}
function svgDataUrl(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

chartSheet.deleteAllDrawings();
chartSheet.getRange("A2:V2").merge();
chartSheet.getRange("A2").values = [["口径：销售 > 发货时间业绩｜左轴：销量、订单数量（折线）｜右轴：发货金额（柱状）"]];
chartSheet.getRange("A2:V2").format = { fill: "#F1F5F9", font: { color: "#475569" }, horizontalAlignment: "center" };

const panels = [
  [series.managerDaily, "店长维度｜按天趋势（双轴）", true, 4],
  [series.managerMonthly, "店长维度｜按月综合（双轴）", false, 25],
  [series.siteDaily, "站点维度｜按天趋势（双轴）", true, 46],
  [series.siteMonthly, "站点维度｜按月综合（双轴）", false, 67],
];
for (const [rows, title, dense, row] of panels) {
  chartSheet.images.add({
    dataUrl: svgDataUrl(svgChart(rows, title, dense)),
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
