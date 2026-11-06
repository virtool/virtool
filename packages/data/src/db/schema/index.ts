// Drizzle table definitions are re-exported from this module. It is the schema
// entry point `drizzle.config.ts` names, so a table missing from the `export *`
// list is missing from the snapshot every migration is generated against. Each
// feature owns a sibling file (e.g. `labels.ts`) and is added to the list as it
// lands.
//
// Infer row and insert types from these tables. Do not copy them into a feature
// `types.ts`. A feature's `data.ts` re-exports the inferred types that other
// server modules share. Function option types, data-layer errors, and
// row-to-contract mappers stay in this package. Wire shapes shared with clients
// belong in `@virtool/contracts`. Convert a legacy `types.ts` when you change
// its feature.
export * from "./analyses";
export * from "./apiKeys";
export * from "./auth";
export * from "./banners";
export * from "./caches";
export * from "./cacheUsageSnapshots";
export * from "./dataMigrations";
export * from "./emailOutbox";
export * from "./groups";
export * from "./history";
export * from "./hmms";
export * from "./indexes";
export * from "./jobs";
export * from "./labels";
export * from "./otus";
export * from "./references";
export * from "./samples";
export * from "./settings";
export * from "./setup";
export * from "./subtractions";
export * from "./tasks";
export * from "./uploads";
export * from "./users";
export * from "./views";
