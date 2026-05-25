const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "public");
const target = path.join(root, "dist");

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      const normalized = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
      fs.writeFileSync(targetPath, normalized, "utf8");
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

if (!fs.existsSync(source)) {
  throw new Error(`Missing static source directory: ${source}`);
}

fs.rmSync(target, { recursive: true, force: true });
copyDirectory(source, target);

console.log(`Static site copied from ${source} to ${target}`);
