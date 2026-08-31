import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点.xlsx";
const previewDir = "D:/Claude-Workspace/ai-photo-editor/report_work";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const summary = await workbook.inspect({ kind: "workbook,sheet,table,drawing", maxChars: 5000, tableMaxRows: 3, tableMaxCols: 7 });
console.log(summary.ndjson ?? summary);
for (const [sheetName, range, filename] of [
  ["汇总", "A1:G31", "before_summary.png"],
  ["店长明细", "A1:F25", "before_manager.png"],
  ["站点明细", "A1:F25", "before_site.png"],
]) {
  const image = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(previewDir + "/" + filename, new Uint8Array(await image.arrayBuffer()));
}
