const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const htmlRoots = [path.join(root, "public")];

const csp = findGlobalCsp(vercelConfig);
const configuredHashes = new Set([...csp.matchAll(/'sha256-([^']+)'/g)].map((match) => match[1]));
const issues = [];
let inlineScriptCount = 0;

for (const htmlRoot of htmlRoots) {
  for (const filePath of listHtmlFiles(htmlRoot)) {
    const html = fs.readFileSync(filePath, "utf8");
    for (const script of inlineScripts(html)) {
      inlineScriptCount += 1;
      const hash = crypto.createHash("sha256").update(script).digest("base64");
      if (!configuredHashes.has(hash)) {
        issues.push(`${display(filePath)} is missing CSP hash 'sha256-${hash}'`);
      }
    }
  }
}

if (issues.length) {
  console.error(`CSP inline script hash check failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`CSP inline script hash check passed: ${inlineScriptCount} inline script(s), ${configuredHashes.size} configured hash(es).`);

function findGlobalCsp(config) {
  for (const rule of config.headers || []) {
    if (rule.source !== "/(.*)") continue;
    for (const header of rule.headers || []) {
      if (String(header.key || "").toLowerCase() === "content-security-policy") {
        return String(header.value || "");
      }
    }
  }
  throw new Error("Global Content-Security-Policy header is missing from vercel.json.");
}

function listHtmlFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      files.push(entryPath);
    }
  }
  return files;
}

function inlineScripts(html) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    scripts.push(match[2] || "");
  }
  return scripts;
}

function display(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}
