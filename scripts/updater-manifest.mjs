// Writes latest.json, the manifest the installed app reads on every launch, from the signed
// installers of the last `npm run build:installers`. Upload it with the installers to the
// GitHub release tagged v<version>; the app's endpoint is that repository's latest release.
//
//   node scripts/updater-manifest.mjs [--notes "What changed"]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const config = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
const [endpoint] = config.plugins.updater.endpoints;
const notesFlag = process.argv.indexOf("--notes");
const notes = notesFlag > 0 ? process.argv[notesFlag + 1] ?? "" : "";

// .../releases/latest/download/latest.json -> .../releases/download/v<version>/<file>
const releaseUrl = endpoint.replace("/releases/latest/download/latest.json", `/releases/download/v${version}/`);
if (releaseUrl === endpoint) throw new Error(`The updater endpoint is not a GitHub latest-release URL: ${endpoint}`);

const bundle = join(root, "src-tauri/target/release/bundle");
const installers = {
  // Installed copies look for their own installer type first, so each one updates in kind.
  "windows-x86_64-nsis": `nsis/${config.productName}_${version}_x64-setup.exe`,
  "windows-x86_64-msi": `msi/${config.productName}_${version}_x64_en-US.msi`,
};
const platforms = {};
for (const [target, file] of Object.entries(installers)) {
  const signature = join(bundle, file + ".sig");
  if (!existsSync(signature)) throw new Error(`Missing ${file}.sig. Build the installers with the signing key (see README).`);
  platforms[target] = { signature: readFileSync(signature, "utf8").trim(), url: releaseUrl + file.split("/").pop() };
}

const manifest = { version, notes, pub_date: new Date().toISOString(), platforms };
const output = join(bundle, "latest.json");
writeFileSync(output, JSON.stringify(manifest, null, 2) + "\n");
console.log(`${output}\nUpload it with ${Object.values(installers).map(file => file.split("/").pop()).join(" and ")} to the v${version} release.`);
