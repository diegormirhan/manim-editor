import { writeFile } from "node:fs/promises";
import { buildSchema } from "../contracts/schema.mjs";

await writeFile(
  "contracts/project.schema.json",
  JSON.stringify(buildSchema(), null, 2) + "\n",
);
