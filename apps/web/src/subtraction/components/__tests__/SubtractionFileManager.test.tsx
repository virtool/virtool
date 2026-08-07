import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeFile } from "@tests/fake/files";
import { mockFindUploads } from "@tests/server-fn/uploads";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { SubtractionFileManager } from "../SubtractionFileManager";

function createFiles(fileNames: string[]) {
	return fileNames.map(
		(fileName: string) =>
			new File(["test"], fileName, { type: "application/gzip" }),
	);
}

describe("<SubtractionFileManager />", () => {
	const path = "/subtractions/uploads?page=1";

	it("should reject uploads that don't pass validation", async () => {
		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		mockFindUploads([createFakeFile({ name: "subtraction.fq.gz" })]);

		await renderWithRouter(<SubtractionFileManager />, path);

		expect(
			await screen.findByText("Drag files here to upload"),
		).toBeInTheDocument();

		await userEvent.upload(
			await screen.findByLabelText("Upload file"),
			createFiles(["test.txt"]),
		);

		expect(
			await screen.findByText("Invalid file names: test.txt"),
		).toBeInTheDocument();
	});
});
