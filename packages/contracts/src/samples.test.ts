import { describe, expect, it } from "vitest";
import { getReadDownloadName } from "./samples";

describe("getReadDownloadName()", () => {
	it("names the file for the sample and the read side", () => {
		expect(getReadDownloadName("Sample", "reads_2.fq.gz")).toBe(
			"Sample_2.fq.gz",
		);
	});

	it("replaces characters that are invalid in filenames", () => {
		expect(getReadDownloadName('a/b\\c:d*e?f"g<h>i|j k', "reads_1.fq.gz")).toBe(
			"a_b_c_d_e_f_g_h_i_j_k_1.fq.gz",
		);
	});

	it("falls back to side 1 for a name without a side", () => {
		expect(getReadDownloadName("Sample", "legacy.fq.gz")).toBe(
			"Sample_1.fq.gz",
		);
	});
});
