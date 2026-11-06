import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { toolSchemas } from "../src/schemas.ts";

const schemas = Object.fromEntries(Object.entries(toolSchemas).map(([name, schema]) => [name, {
  inputSchema: z.toJSONSchema(schema.input),
  outputSchema: z.toJSONSchema(schema.output),
}]));
await mkdir(new URL("../schemas/", import.meta.url), {recursive: true});
await writeFile(new URL("../schemas/tools.json", import.meta.url), JSON.stringify(schemas, null, 2) + "\n");
console.log("Exported schemas for six media tools.");
