import { readFile } from "node:fs/promises";
import path from "node:path";

const SUPPORTED_ACTIONS = new Set([
  "clickRole",
  "clickText",
  "goto",
  "globalSearchOpen",
  "highlightText",
  "note",
  "press",
  "screenshot",
  "wait",
  "waitForAnyText",
  "waitForText"
]);
const SUPPORTED_VALUE_MOMENTS = new Set(["major", "page", "detail"]);

const manifestPath = path.resolve(process.argv[2] || "manifests/finance-pl-cash360.demo.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const errors = [];

required(manifest.version, "version");
required(manifest.id, "id");
required(manifest.name, "name");
required(manifest.context?.baseUrl, "context.baseUrl");
required(manifest.context?.login?.readyText, "context.login.readyText");

if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) {
  errors.push("segments must be a non-empty array");
} else {
  const seenIds = new Set();
  manifest.segments.forEach((segment, segmentIndex) => {
    const prefix = `segments[${segmentIndex}]`;
    required(segment.id, `${prefix}.id`);
    required(segment.title, `${prefix}.title`);
    required(segment.valueStatement, `${prefix}.valueStatement`);
    required(segment.narration, `${prefix}.narration`);
    if (segment.valueMoment && !SUPPORTED_VALUE_MOMENTS.has(segment.valueMoment)) {
      errors.push(`${prefix}.valueMoment must be major, page, or detail`);
    }

    if (segment.id) {
      if (seenIds.has(segment.id)) errors.push(`${prefix}.id is duplicated: ${segment.id}`);
      seenIds.add(segment.id);
    }

    if (!Array.isArray(segment.actions)) {
      errors.push(`${prefix}.actions must be an array`);
    } else {
      segment.actions.forEach((action, actionIndex) => {
        const actionPrefix = `${prefix}.actions[${actionIndex}]`;
        if (!SUPPORTED_ACTIONS.has(action.type)) {
          errors.push(`${actionPrefix}.type is unsupported: ${action.type}`);
        }
        if (["clickText", "highlightText", "waitForText"].includes(action.type) && !action.text) {
          errors.push(`${actionPrefix}.text is required for ${action.type}`);
        }
        if (action.type === "waitForAnyText" && (!Array.isArray(action.texts) || action.texts.length === 0)) {
          errors.push(`${actionPrefix}.texts must be a non-empty array`);
        }
        if (action.type === "goto" && !action.url) {
          errors.push(`${actionPrefix}.url is required for goto`);
        }
        if (action.type === "globalSearchOpen" && !action.query) {
          errors.push(`${actionPrefix}.query is required for globalSearchOpen`);
        }
        if (action.type === "clickRole" && (!action.role || !action.name)) {
          errors.push(`${actionPrefix}.role and ${actionPrefix}.name are required for clickRole`);
        }
      });
    }

    for (const verification of segment.verifications || []) {
      if (verification.type !== "text") errors.push(`${prefix}.verifications only supports type "text"`);
      if (!verification.text) errors.push(`${prefix}.verifications text is required`);
    }
  });
}

if (errors.length > 0) {
  console.error("Manifest validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Manifest looks good: ${manifestPath}`);
console.log(`Validated ${manifest.segments.length} segments.`);

function required(value, label) {
  if (value === undefined || value === null || value === "") {
    errors.push(`${label} is required`);
  }
}
