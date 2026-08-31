import { Workbook } from "@oai/artifact-tool";

const workbook = Workbook.create();
console.log(workbook.help("*", {
  search: "secondaryAxis|axisGroup|combo|chartType|series",
  include: "index,examples,notes",
  maxChars: 6000,
}).ndjson);
