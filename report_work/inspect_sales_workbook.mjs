import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点.xlsx";
const previewPath = "D:/Claude-Workspace/ai-photo-editor/report_work/source_preview.png";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 10,
  tableMaxCellChars: 80,
});
console.log(summary.ndjson);
const detail = await workbook.inspect({
  kind: "table",
  range: "店长明细!A1:F12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 6,
  maxChars: 6000,
});
console.log(detail.ndjson);
const preview = await workbook.render({ sheetName: "店长明细", range: "A1:F35", scale: 1.5, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
