import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "D:/Claude-Workspace/ai-photo-editor/outputs/2026年每日销售统计_店长与站点_按人员站点图表版.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 200 },
  summary: "final exported workbook formula error scan",
});
const drawings = await workbook.inspect({ kind: "drawing", maxChars: 8000 });
const helper = workbook.worksheets.getItem("图表数据").getRange("A5:AF7");
console.log("ERRORS", errors.ndjson);
console.log("DRAWINGS", drawings.ndjson);
console.log("HELPER", JSON.stringify({ values: helper.values, formulas: helper.formulas }));
