import { expect, it } from "vitest";
import { defineAudit } from "./define";
import {
	BOOTSTRAP_MIGRATION_TAG,
	getDataMigrationAssertion,
	validateMigrationPairs,
} from "./pairs";

function fixture() {
	const registry = {
		demo: defineAudit({
			key: "demo",
			version: 1,
			migrationTag: "0024_demo",
			kind: "audit",
			description: "fixture",
			async run() {},
		}),
	};
	const files: [
		{ tag: string; sql: string[] },
		{ tag: string; sql: string[] },
	] = [
		{ tag: BOOTSTRAP_MIGRATION_TAG, sql: ["bootstrap"] },
		{ tag: "0024_demo", sql: [getDataMigrationAssertion("demo", 1)] },
	];
	return { files, registry };
}

it("pairs an assertion-only SQL migration with its implementation", () => {
	const { files, registry } = fixture();
	expect(validateMigrationPairs(files, registry).get("0024_demo")).toBe(
		registry.demo,
	);
});

it("rejects SQL requiring an implementation missing from the image", () => {
	const { files } = fixture();
	expect(() => validateMigrationPairs(files, {})).toThrow(
		"missing or ambiguous implementation",
	);
});

it("rejects two bodies at one SQL boundary", () => {
	const { files, registry } = fixture();
	const duplicate = { ...registry, other: { ...registry.demo, key: "other" } };
	expect(() => validateMigrationPairs(files, duplicate)).toThrow(
		"duplicate pair",
	);
});

it.each(["missing", "wrong_version", "wrong_key", "late"])(
	"rejects a %s assertion",
	(kind) => {
		const { files, registry } = fixture();
		files[1].sql =
			kind === "missing"
				? ["select 1"]
				: kind === "late"
					? ["select 1", getDataMigrationAssertion("demo", 1)]
					: [
							getDataMigrationAssertion(
								kind === "wrong_key" ? "other" : "demo",
								kind === "wrong_version" ? 2 : 1,
							),
						];
		expect(() => validateMigrationPairs(files, registry)).toThrow(
			"missing or mismatched",
		);
	},
);

it("rejects a pair before the framework tables exist", () => {
	const { files, registry } = fixture();
	registry.demo.migrationTag = BOOTSTRAP_MIGRATION_TAG;
	expect(() => validateMigrationPairs(files, registry)).toThrow("must follow");
});

it("rejects a definition whose SQL tag is absent", () => {
	const { files, registry } = fixture();
	registry.demo.migrationTag = "0099_missing";
	expect(() => validateMigrationPairs(files, registry)).toThrow(
		"missing from the journal",
	);
});

it("rejects registry key disagreement", () => {
	const { files, registry } = fixture();
	registry.demo.key = "other";
	expect(() => validateMigrationPairs(files, registry)).toThrow(
		"invalid data migration key",
	);
});
