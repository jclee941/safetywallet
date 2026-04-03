#!/usr/bin/env node
/**
 * CI Guard: Ensure root wrangler.toml and apps/api/wrangler.toml
 * share the same binding IDs (database_id, hyperdrive id, kv id, crons).
 *
 * Resource names (bucket_name, queue, database_name) are allowed to differ
 * because root and app configs may reference different CF environments.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "wrangler.toml");
const APP = path.resolve(__dirname, "..", "apps", "api", "wrangler.toml");

function readToml(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`✗ File not found: ${filePath}`);
    process.exit(1);
  }
  return fs.readFileSync(filePath, "utf-8");
}

/** Extract all values for a given key across the TOML file (handles duplicates) */
function extractAll(content, key) {
  const re = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "gm");
  const values = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    values.push(m[1]);
  }
  return values;
}

/** Extract crons array */
function extractCrons(content) {
  const m = content.match(/^crons\s*=\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1].match(/"([^"]*)"/g)?.map((s) => s.replace(/"/g, "")) ?? [];
}

/** Extract hyperdrive id (first 'id' after [[hyperdrive]] line) */
function extractHyperdriveId(content) {
  const lines = content.split("\n");
  let inHyperdrive = false;
  for (const line of lines) {
    if (
      /^\[\[hyperdrive\]\]/.test(line) ||
      /^\[\[env\.\w+\.hyperdrive\]\]/.test(line)
    ) {
      // Only match prod (non-env) section
      if (!/env\./.test(line)) inHyperdrive = true;
      continue;
    }
    if (inHyperdrive) {
      const m = line.match(/^\s*id\s*=\s*"([^"]*)"/);
      if (m) return m[1];
      if (/^\[/.test(line)) break;
    }
  }
  return null;
}

/** Extract KV namespace id (first 'id' after [[kv_namespaces]] line) */
function extractKvId(content) {
  const lines = content.split("\n");
  let inKv = false;
  for (const line of lines) {
    if (/^\[\[kv_namespaces\]\]/.test(line)) {
      inKv = true;
      continue;
    }
    if (inKv) {
      const m = line.match(/^\s*id\s*=\s*"([^"]*)"/);
      if (m) return m[1];
      if (/^\[/.test(line)) break;
    }
  }
  return null;
}

/** Extract assets binding from [assets] section */
function extractAssetsBinding(content) {
  const lines = content.split("\n");
  let inAssets = false;
  for (const line of lines) {
    if (/^\[assets\]/.test(line)) {
      inAssets = true;
      continue;
    }
    if (inAssets) {
      const m = line.match(/^\s*binding\s*=\s*"([^"]*)"/);
      if (m) return m[1];
      if (/^\[/.test(line)) break;
    }
  }
  return null;
}

const rootContent = readToml(ROOT);
const appContent = readToml(APP);

const checks = [
  { label: "D1 database_id", key: "database_id" },
  { label: "Hyperdrive id", key: "id", section: "hyperdrive" },
  { label: "KV namespace id", key: "id", section: "kv_namespaces" },
];

let failures = 0;

for (const check of checks) {
  const rootVals = extractAll(rootContent, check.key);
  const appVals = extractAll(appContent, check.key);

  if (check.section === "hyperdrive") {
    // Hyperdrive id is the first non-database_id 'id' after [[hyperdrive]]
    const rootId = extractHyperdriveId(rootContent);
    const appId = extractHyperdriveId(appContent);
    if (rootId !== appId) {
      console.error(
        `✗ ${check.label} mismatch: root="${rootId}" app="${appId}"`,
      );
      failures++;
    } else {
      console.log(`✓ ${check.label}: ${rootId}`);
    }
    continue;
  }

  if (check.section === "kv_namespaces") {
    const rootId = extractKvId(rootContent);
    const appId = extractKvId(appContent);
    if (rootId !== appId) {
      console.error(
        `✗ ${check.label} mismatch: root="${rootId}" app="${appId}"`,
      );
      failures++;
    } else {
      console.log(`✓ ${check.label}: ${rootId}`);
    }
    continue;
  }

  // For database_id, first occurrence in prod section
  const rootVal = rootVals[0];
  const appVal = appVals[0];
  if (rootVal !== appVal) {
    console.error(
      `✗ ${check.label} mismatch: root="${rootVal}" app="${appVal}"`,
    );
    failures++;
  } else {
    console.log(`✓ ${check.label}: ${rootVal}`);
  }
}

// Check crons (root may omit crons — CF Git Integration deploys without scheduled triggers)
const rootCrons = extractCrons(rootContent);
const appCrons = extractCrons(appContent);
if (rootCrons.length === 0 && appCrons.length > 0) {
  console.log(
    `✓ Crons: root omitted (app defines ${appCrons.length} schedules — OK)`,
  );
} else if (JSON.stringify(rootCrons) !== JSON.stringify(appCrons)) {
  console.error(
    `✗ Crons mismatch:\n  root: ${JSON.stringify(rootCrons)}\n  app:  ${JSON.stringify(appCrons)}`,
  );
  failures++;
} else {
  console.log(`✓ Crons: ${JSON.stringify(rootCrons)}`);
}

// Check compatibility_date
const rootCompat = extractAll(rootContent, "compatibility_date")[0];
const appCompat = extractAll(appContent, "compatibility_date")[0];
if (rootCompat !== appCompat) {
  console.error(
    `✗ compatibility_date mismatch: root="${rootCompat}" app="${appCompat}"`,
  );
  failures++;
} else {
  console.log(`✓ compatibility_date: ${rootCompat}`);
}

// Check assets binding
const rootAssetsBinding = extractAssetsBinding(rootContent);
const appAssetsBinding = extractAssetsBinding(appContent);
if (rootAssetsBinding !== appAssetsBinding) {
  console.error(
    `✗ ASSETS binding mismatch: root="${rootAssetsBinding}" app="${appAssetsBinding}"`,
  );
  failures++;
} else {
  console.log(`✓ ASSETS binding: ${rootAssetsBinding}`);
}

// Final exit gate - MUST be last
if (failures > 0) {
  console.error(
    `\n✗ ${failures} binding(s) out of sync between root and app wrangler.toml`,
  );
  process.exit(1);
} else {
  console.log("\n✓ All critical bindings are in sync.");
}
