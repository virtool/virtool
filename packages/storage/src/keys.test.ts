import { describe, expect, it } from "vitest";
import {
	analysisFileKey,
	cacheKey,
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	indexFileKey,
	indexPrefix,
	sampleFileKey,
	samplePrefix,
	sampleStorageId,
	subtractionFileKey,
	subtractionPrefix,
	uploadFileKey,
} from "./keys";

describe("storage keys", () => {
	it("composes upload and analysis keys", () => {
		expect(uploadFileKey("1-reads.fq.gz")).toBe("files/1-reads.fq.gz");
		expect(analysisFileKey("nuvs.json")).toBe("analyses/nuvs.json");
	});

	it("composes sample keys and prefixes", () => {
		expect(sampleFileKey("abc123", "reads_1.fq.gz")).toBe(
			"samples/abc123/reads_1.fq.gz",
		);
		expect(samplePrefix("abc123")).toBe("samples/abc123/");
	});

	it("keeps the legacy id as a sample's storage id when it has one", () => {
		expect(sampleStorageId(7, "abc123")).toBe("abc123");
		expect(sampleStorageId(7, null)).toBe("7");
	});

	it("composes index keys and prefixes", () => {
		expect(indexFileKey("idx1", "otus.json.gz")).toBe(
			"indexes/idx1/otus.json.gz",
		);
		expect(indexPrefix("idx1")).toBe("indexes/idx1/");
	});

	it("substitutes underscores for spaces in subtraction ids", () => {
		expect(subtractionFileKey("Homo sapiens", "subtraction.fa.gz")).toBe(
			"subtractions/Homo_sapiens/subtraction.fa.gz",
		);
		expect(subtractionPrefix("Homo sapiens")).toBe(
			"subtractions/Homo_sapiens/",
		);
	});

	it("composes cache and hmm keys", () => {
		expect(cacheKey("d34db33f")).toBe("caches/v1/d34db33f");
		expect(HMM_PROFILES_KEY).toBe("hmm/profiles.hmm");
		expect(HMM_ANNOTATIONS_KEY).toBe("hmm/annotations.json.gz");
	});
});
