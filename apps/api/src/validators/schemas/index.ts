// Barrel re-export of all schemas
// This maintains backward compatibility with existing imports from "../validators/schemas"

// shared.ts is internal-only (enum arrays, primitives) — not re-exported
export * from "./auth.js";
export * from "./posts.js";
export * from "./reviews.js";
export * from "./actions.js";
export * from "./sites.js";
export * from "./education.js";
export * from "./points.js";
