import { createFakeAccount } from "@tests/fake/account";
import { createFakeFile } from "@tests/fake/files";
import { createFakeJobNested } from "@tests/fake/jobs";
import { createFakeSample } from "@tests/fake/samples";
import type { JobState } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import {
	checkCanDeleteSample,
	checkCanEditSample,
	getCreateSampleRequest,
	getSampleNameFromReads,
} from "../utils";

describe("getSampleNameFromReads", () => {
	it.each([
		"fq",
		"fastq",
		"fa",
		"fasta",
		"fq.gz",
		"fastq.gz",
		"fq.bz2",
		"fastq.bz2",
		"FASTQ.GZ",
	])("drops the .%s extension", (extension) => {
		const file = createFakeFile({ name: `sample_one.${extension}` });

		expect(getSampleNameFromReads([file])).toBe("sample_one");
	});

	it.each([
		["_R", "sample_one_R1.fastq.gz", "sample_one_R2.fastq.gz"],
		["_", "sample_one_1.fastq.gz", "sample_one_2.fastq.gz"],
		["dotted", "sample_one.1.fastq.gz", "sample_one.2.fastq.gz"],
		["bzip2", "sample_one_R1.fastq.bz2", "sample_one_R2.fastq.bz2"],
	])(
		"drops the %s mate token so both mates of a pair yield one name",
		(_convention, left, right) => {
			const r1 = createFakeFile({ name: left });
			const r2 = createFakeFile({ name: right });

			expect(getSampleNameFromReads([r1, r2])).toBe("sample_one");
		},
	);

	it("keeps the mate token when the file is unpaired", () => {
		const r1 = createFakeFile({ name: "sample_one_R1.fastq.gz" });

		expect(getSampleNameFromReads([r1])).toBe("sample_one_R1");
	});

	it("returns an empty string when the file isn't a read file", () => {
		const file = createFakeFile({ name: "notes.txt" });

		expect(getSampleNameFromReads([file])).toBe("");
	});

	it("returns an empty string when there are no reads", () => {
		expect(getSampleNameFromReads([])).toBe("");
	});
});

describe("getCreateSampleRequest", () => {
	const values = {
		group: "3",
		labels: [1, 2],
		libraryType: "srna",
		name: "Sample A",
		subtractionIds: [1],
	};

	it("maps the form values and read files onto the request", () => {
		expect(
			getCreateSampleRequest({ ...values, host: "h", isolate: "i" }, [7, 8]),
		).toEqual({
			files: [7, 8],
			group: "3",
			host: "h",
			isolate: "i",
			labels: [1, 2],
			libraryType: "srna",
			locale: "",
			name: "Sample A",
			subtractions: [1],
		});
	});

	it("sends metadata a form doesn't collect as empty strings", () => {
		const request = getCreateSampleRequest(values, [7]);

		expect(request.host).toBe("");
		expect(request.isolate).toBe("");
		expect(request.locale).toBe("");
	});

	it("sends an unset group as null", () => {
		expect(getCreateSampleRequest({ ...values, group: "" }, [7]).group).toBe(
			null,
		);
	});
});

describe("checkCanEditSample", () => {
	const owner = createFakeAccount({ administratorRole: null });
	const other = createFakeAccount({
		administratorRole: null,
		id: owner.id + 1,
	});
	const [group] = other.groups;

	const locked = createFakeSample({
		allWrite: false,
		group: group ?? null,
		groupWrite: false,
		user: { ...createFakeSample().user, id: owner.id },
	});

	it.each([
		[
			"a full administrator",
			createFakeAccount({ administratorRole: "full" }),
			{},
			true,
		],
		["the owner", owner, {}, true],
		["any user when all may write", other, { allWrite: true }, true],
		[
			"a group member when the group may write",
			other,
			{ groupWrite: true },
			true,
		],
		["a group member when the group may not write", other, {}, false],
		[
			"a user administrator who is not the owner",
			{ ...other, administratorRole: "users" as const },
			{},
			false,
		],
		[
			"a user outside the group",
			{ ...other, groups: [] },
			{ groupWrite: true },
			false,
		],
	])("decides for %s", (_, account, overrides, expected) => {
		expect(checkCanEditSample(account, { ...locked, ...overrides })).toBe(
			expected,
		);
	});
});

describe("checkCanDeleteSample", () => {
	it("allows a ready sample", () => {
		expect(checkCanDeleteSample(true)).toBe(true);
	});

	it.each<[JobState, boolean]>([
		["cancelled", true],
		["failed", true],
		["pending", false],
		["running", false],
		["succeeded", false],
	])("decides for an unready sample whose job is %s", (state, expected) => {
		expect(checkCanDeleteSample(false, createFakeJobNested({ state }))).toBe(
			expected,
		);
	});

	it("refuses an unready sample with no job", () => {
		expect(checkCanDeleteSample(false)).toBe(false);
	});
});
