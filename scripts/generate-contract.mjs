import { readFile, writeFile, mkdir } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import standalone from "ajv/dist/standalone/index.js";
import { compile } from "json-schema-to-typescript";
import ucs2module from "ajv/dist/runtime/ucs2length.js";

const schema = JSON.parse(
  await readFile("contracts/project.schema.json", "utf8"),
);
const ajv = new Ajv2020({ strict: false, code: { source: true, esm: true } });
const validator = ajv.compile(schema);
await mkdir("src/generated", { recursive: true });
const source = standalone(ajv, validator).replace(
  'require("ajv/dist/runtime/ucs2length").default',
  "ucs2length",
);
await writeFile(
  "src/generated/validate.js",
  'const ucs2length = ' + (ucs2module.default ?? ucs2module).toString() + ';\n' + source,
);
await writeFile("src/generated/project.d.ts", await compile(schema, "Project"));
