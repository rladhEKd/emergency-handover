import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = ["app", "components", "data"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".json"]);
const suspiciousFragments = [
  "???",
  "\uFFFD",
  "\uF9CE",
  "?\uBDC0",
  "?\uB304",
  "?\u0080",
  "?\uAFE9",
  "?\uC12E",
  "?\uACE8",
  "?\uC495",
  "?\uB2FF",
  "?\uACD7",
  "?\u315C",
  "?\uB8F7",
];

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (extensions.has(path.extname(entry.name))) {
      files.push(full);
    }
  }

  return files;
}

const findings = [];

for (const target of targets) {
  const fullTarget = path.join(root, target);
  try {
    if (!statSync(fullTarget).isDirectory()) continue;
  } catch {
    continue;
  }

  for (const file of walk(fullTarget)) {
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const fragment of suspiciousFragments) {
        if (!line.includes(fragment)) continue;
        if (line.includes("normalized ===") || line.includes("suspiciousFragments")) continue;
        findings.push(`${path.relative(root, file)}:${index + 1}: ${fragment}`);
        break;
      }
    });
  }
}

if (findings.length > 0) {
  console.error("Broken UI text detected:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("UI text integrity check passed.");
