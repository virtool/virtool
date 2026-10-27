import { describe, expect, it } from "vitest";
import { createAzureStorage } from "./azure";

describe("presigned Azure origins", () => {
	const endpoint = "http://azurite:10000/devstoreaccount1";

	it.each([
		[undefined, "http://azurite:10000"],
		["https://virtool.local", "https://virtool.local"],
		["https://virtool.local:8443", "https://virtool.local:8443"],
	])("rehosts uploads and downloads on %s", async (origin, expected) => {
		const storage = createAzureStorage({
			kind: "azure",
			account: "devstoreaccount1",
			container: "virtool",
			accessKey: Buffer.from("test-key").toString("base64"),
			endpoint,
			uploadUrl: origin,
			downloadUrl: origin,
		});

		if (!storage.presignUpload || !storage.presignDownload) {
			throw new Error("Azure storage must support presigning");
		}

		const urls = await Promise.all([
			storage.presignUpload("uploads/test.fastq", { expiresIn: 900 }),
			storage.presignDownload("uploads/test.fastq", {
				expiresIn: 900,
				contentDisposition: "attachment",
				contentType: "application/octet-stream",
			}),
		]);

		for (const value of urls) {
			const url = new URL(value);
			expect(url.origin).toBe(expected);
			expect(url.pathname).toBe("/devstoreaccount1/virtool/uploads/test.fastq");
			expect(url.searchParams.get("sig")).toBeTruthy();
		}
	});
});
