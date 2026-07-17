import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(process.cwd(), "../../infra/postgres/migrations");
const files = (await readdir(directory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
if (!files.length) throw new Error("No SQL migrations found");

for (let index = 0; index < files.length; index += 1) {
  const expected = String(index + 1).padStart(4, "0");
  if (!files[index].startsWith(expected)) throw new Error(`Migration sequence gap at ${files[index]}`);
  const sql = (await readFile(resolve(directory, files[index]), "utf8")).trim();
  if (!/^BEGIN;/i.test(sql) || !/COMMIT;$/i.test(sql)) throw new Error(`${files[index]} must be a forward transaction`);
  if (/\b(?:DROP\s+DATABASE|TRUNCATE|RESET\s+SCHEMA)\b/i.test(sql)) throw new Error(`${files[index]} contains a destructive operation`);
}

console.log(`Validated ${files.length} forward SQL migrations.`);
