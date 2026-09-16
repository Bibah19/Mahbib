const fs = require("node:fs");
const path = require("node:path");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
      walk(full);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(entry.name)) continue;
    const lines = fs.readFileSync(full, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (/[—–·]/.test(line)) console.log(`${full}:${index + 1}: ${line.trim().slice(0, 220)}`);
    });
  }
}

walk(process.argv[2]);
