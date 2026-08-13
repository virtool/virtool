import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ZipArchiveError, ZipMemberMissingError } from "./errors";
import { readZipMember } from "./zip";

function encode(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

describe("readZipMember", () => {
	it("reads the named member", () => {
		const archive = zipSync({
			"ABC123_1.json": encode('{"BlastOutput2":{}}'),
			"ABC123_2.json": encode("other"),
		});

		expect(
			new TextDecoder().decode(readZipMember(archive, "ABC123_1.json")),
		).toBe('{"BlastOutput2":{}}');
	});

	it("throws when the archive carries no such member", () => {
		const archive = zipSync({ "ABC123_2.json": encode("other") });

		expect(() => readZipMember(archive, "ABC123_1.json")).toThrow(
			ZipMemberMissingError,
		);
	});

	it("throws when the bytes are not a zip archive", () => {
		expect(() =>
			readZipMember(encode("<html>an outage page</html>"), "x"),
		).toThrow(ZipArchiveError);
	});
});
