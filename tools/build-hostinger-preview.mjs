import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafePreviewFiles, createHostingerHtaccess, getApiIsolationPaths, getNpmInvocation, getPreviewBuildCleanupPaths } from "./hostinger-preview-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { source: apiDirectory, backup: apiBackup } = getApiIsolationPaths(root);
const outputDirectory = path.join(root, "out");
const distDirectory = path.join(root, "dist");
const archivePath = path.join(distDirectory, "dice-invoker-hostinger-preview.zip");

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`${command} terminou com código ${code}`)));
  });
}

async function collectFiles(directory, relative = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const collected = [];
  for (const entry of entries) {
    const relativePath = path.join(relative, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collected.push(...await collectFiles(absolutePath, relativePath));
      continue;
    }
    const textExtension = /(?:\.html?|\.m?js|\.css|\.json|\.txt|\.xml|\.map|\.htaccess)$/i.test(entry.name);
    collected.push({
      path: relativePath,
      content: textExtension ? await fs.readFile(absolutePath, "utf8") : null,
    });
  }
  return collected;
}

async function createArchive() {
  await fs.rm(archivePath, { force: true });
  if (process.platform === "win32") {
    await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${outputDirectory.replaceAll("'", "''")}\\*' -DestinationPath '${archivePath.replaceAll("'", "''")}' -Force`,
    ]);
    return;
  }
  await run("zip", ["-q", "-r", archivePath, "."], { ...process.env, PWD: outputDirectory });
}

async function main() {
  for (const directory of getPreviewBuildCleanupPaths(root)) {
    await fs.rm(directory, { recursive: true, force: true });
  }
  await fs.mkdir(distDirectory, { recursive: true });
  await fs.rm(apiBackup, { recursive: true, force: true });

  let apiWasMoved = false;
  try {
    await fs.rename(apiDirectory, apiBackup);
    apiWasMoved = true;
    const npm = getNpmInvocation(process.platform, process.env, process.execPath);
    await run(npm.command, [...npm.args, "run", "build"], {
      ...process.env,
      HOSTINGER_STATIC_EXPORT: "1",
      NEXT_PUBLIC_HOSTINGER_PREVIEW: "1",
    });
  } finally {
    if (apiWasMoved) await fs.rename(apiBackup, apiDirectory);
  }

  await fs.writeFile(path.join(outputDirectory, ".htaccess"), createHostingerHtaccess(), "utf8");
  await fs.writeFile(
    path.join(outputDirectory, "LEIA-ME-PREVIA.txt"),
    "Dice Invoker — prévia estática. Login, persistência e ranking competitivo permanecem desativados neste pacote.\n",
    "utf8",
  );
  const files = await collectFiles(outputDirectory);
  assertSafePreviewFiles(files);
  await createArchive();
  console.log(`\nPrévia segura criada em:\n${archivePath}\n`);
}

await main();
