const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "public", "FantasyIQ");
const mirrorRoot = path.join(root, "FantasyIQ");

const files = [
  "app.js",
  "config.js",
  "index.html",
  "styles.css",
  path.join("assets", "fantasy-iq-logo.svg"),
  path.join("assets", "myfantasyiq-wordmark.svg"),
  path.join("assets", "league-logo.jpeg"),
  path.join("data", "boards.json"),
  path.join("data", "boards_data.js"),
];

const directories = ["js"];

for (const relativePath of files) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(mirrorRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing dashboard source file: ${source}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

for (const relativePath of directories) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(mirrorRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing dashboard source directory: ${source}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  copyDirectory(source, target);
}

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

console.log(`Synced ${files.length} dashboard mirror files and ${directories.length} dashboard directories from public/FantasyIQ.`);
