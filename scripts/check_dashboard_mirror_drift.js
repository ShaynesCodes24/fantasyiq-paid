const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "public", "FantasyIQ");
const syncScript = path.join(__dirname, "sync_dashboard_mirror.js");

const copyOperations = [];
const replacedDirectoryTargets = new Set();

const fakeFs = {
  existsSync: fs.existsSync.bind(fs),
  readdirSync: fs.readdirSync.bind(fs),
  mkdirSync() {},
  rmSync(target) {
    replacedDirectoryTargets.add(path.resolve(target));
  },
  copyFileSync(source, target) {
    copyOperations.push({
      source: path.resolve(source),
      target: path.resolve(target),
    });
  },
};

const context = {
  __dirname,
  console: {
    log() {},
  },
  require(moduleName) {
    if (moduleName === "fs") {
      return fakeFs;
    }
    if (moduleName === "path") {
      return path;
    }
    throw new Error(`Unsupported module in mirror sync discovery: ${moduleName}`);
  },
};

try {
  vm.runInNewContext(fs.readFileSync(syncScript, "utf8"), context, {
    filename: syncScript,
  });
} catch (error) {
  console.error(`Unable to discover dashboard mirror coverage from ${display(syncScript)}.`);
  console.error(error.message);
  process.exit(1);
}

const issues = [];
const expectedTargets = new Map();
const expectedDirectoryFiles = new Map();
const expectedDirectorySources = new Map();

for (const operation of copyOperations) {
  const relativePath = path.relative(sourceRoot, operation.source);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    issues.push(`Unexpected source outside canonical dashboard: ${display(operation.source)}`);
    continue;
  }

  expectedTargets.set(operation.target, operation.source);

  const copiedDirectory = firstReplacedDirectorySegment(relativePath);
  if (copiedDirectory) {
    const targetRoot = rootForTarget(operation.target, relativePath);
    const targetDirectory = path.join(targetRoot, copiedDirectory);
    const directorySet = expectedDirectoryFiles.get(targetDirectory) || new Set();
    directorySet.add(operation.target);
    expectedDirectoryFiles.set(targetDirectory, directorySet);
    expectedDirectorySources.set(targetDirectory, path.join(sourceRoot, copiedDirectory));
  }
}

for (const [target, source] of expectedTargets.entries()) {
  if (!fs.existsSync(source)) {
    issues.push(`Missing canonical source: ${display(source)}`);
    continue;
  }
  if (!fs.existsSync(target)) {
    issues.push(`Missing mirror file: ${display(target)} (expected ${display(source)})`);
    continue;
  }
  if (!sameFile(source, target)) {
    issues.push(`Mirror differs: ${display(target)} (expected ${display(source)})`);
  }
}

for (const [targetDirectory, expectedFiles] of expectedDirectoryFiles.entries()) {
  if (!replacedDirectoryTargets.has(targetDirectory)) {
    continue;
  }
  if (!fs.existsSync(targetDirectory)) {
    issues.push(`Missing mirror directory: ${display(targetDirectory)}`);
    continue;
  }
  for (const actualFile of listFiles(targetDirectory)) {
    if (!expectedFiles.has(actualFile)) {
      issues.push(
        `Extra mirror file: ${display(actualFile)} (not present under ${display(expectedDirectorySources.get(targetDirectory))})`
      );
    }
  }
}

if (issues.length > 0) {
  console.error(`Dashboard mirror drift check failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

const mirrorRoots = new Set(
  [...expectedTargets.keys()].map((target) => rootForTarget(target, path.relative(sourceRoot, expectedTargets.get(target))))
);

console.log(
  `Dashboard mirror drift check passed: ${expectedTargets.size} mirrored files match public/FantasyIQ across ${mirrorRoots.size} target roots.`
);

function sameFile(first, second) {
  const firstStat = fs.statSync(first);
  const secondStat = fs.statSync(second);
  if (!firstStat.isFile() || !secondStat.isFile() || firstStat.size !== secondStat.size) {
    return false;
  }
  return hashFile(first) === hashFile(second);
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(path.resolve(entryPath));
    }
  }
  return files;
}

function firstReplacedDirectorySegment(relativePath) {
  const firstSegment = relativePath.split(path.sep)[0];
  for (const targetDirectory of replacedDirectoryTargets) {
    if (path.basename(targetDirectory) === firstSegment) {
      return firstSegment;
    }
  }
  return null;
}

function rootForTarget(target, relativePath) {
  const segmentCount = relativePath.split(path.sep).filter(Boolean).length;
  return path.resolve(target, ...Array(segmentCount).fill(".."));
}

function display(filePath) {
  const relativePath = path.relative(root, filePath);
  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return relativePath.split(path.sep).join("/");
  }
  return filePath;
}
