// Signs the installers of the last `npm run build:installers` with the updater key, writes
// latest.json, the manifest the installed app reads on every launch, and copies both into
// Releases/v<version>. Upload that folder to the GitHub release tagged v<version>; the app's
// endpoint is that repository's latest release.
//
//   node scripts/updater-manifest.mjs [--notes "What changed"]
//
// The key is %USERPROFILE%\.tauri\manim-editor.key or TAURI_SIGNING_PRIVATE_KEY_PATH, its password
// TAURI_SIGNING_PRIVATE_KEY_PASSWORD (empty when unset). The bundler does not sign: Windows
// PowerShell cannot hand it an empty password, and it then waits for one on the console.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
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
const key = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ?? join(homedir(), ".tauri", "manim-editor.key");
if (!existsSync(key)) throw new Error(`Updater signing key not found at ${key}. See README.md, Publishing an update.`);
const platforms = {};
for (const [target, file] of Object.entries(installers)) {
  const installer = join(bundle, file);
  if (!existsSync(installer)) throw new Error(`Missing ${file}. Run npm run build:installers first.`);
  const signed = spawnSync(process.execPath, [join(root, "node_modules/@tauri-apps/cli/tauri.js"), "signer", "sign",
    "--private-key-path", key, `--password=${process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? ""}`, installer],
  { stdio: ["ignore", "ignore", "inherit"] });
  if (signed.status !== 0) throw new Error(`Signing ${file} failed.`);
  platforms[target] = { signature: readFileSync(installer + ".sig", "utf8").trim(), url: releaseUrl + file.split("/").pop() };
}

const manifest = { version, notes, pub_date: new Date().toISOString(), platforms };
const output = join(bundle, "latest.json");
writeFileSync(output, JSON.stringify(manifest, null, 2) + "\n");
const release = join(root, "Releases", `v${version}`);
mkdirSync(release, { recursive: true });
for (const file of [...Object.values(installers), "latest.json"]) copyFileSync(join(bundle, file), join(release, basename(file)));
console.log(`${release}\nUpload its files to the v${version} release.`);
