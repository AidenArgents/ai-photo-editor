import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [sheetName, range, outputName, scaleText = "1"] = process.argv.slice(2);
const sourcePath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_按人员站点图表版.xlsx";
const outputPath = `D:/Claude-Workspace/ai-photo-editor/report_work/${outputName}`;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));

const sheet = workbook.worksheets.getItem(sheetName);
const checkRange = sheet.getRange(range);
console.log(JSON.stringify({ values: checkRange.values, formulas: checkRange.formulas }));
const preview = await workbook.render({ sheetName, range, scale: Number(scaleText), format: "png" });
await fs.writeFile(outputPath, new Uint8Array(await preview.arrayBuffer()));
console.log(`PREVIEW ${outputPath}`);
