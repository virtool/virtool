import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockCreateIsolate } from "@tests/server-fn/otus";
import { renderWithProviders } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateIsolate from "../CreateIsolate";

describe("<CreateIsolate />", () => {
	let props: ComponentProps<typeof CreateIsolate>;

	beforeEach(() => {
		props = {
			allowedSourceTypes: ["isolate", "genotype"],
			restrictSourceTypes: true,
			otuId: "test",
			show: true,
			onHide: vi.fn(),
		};
	});

	it("should render properly", () => {
		renderWithProviders(<CreateIsolate {...props} />);

		expect(screen.getByText("Create Isolate")).toBeInTheDocument();
		expect(screen.getByText("Source Type")).toBeInTheDocument();
		expect(screen.getByText("Source Name")).toBeInTheDocument();
		expect(screen.getByText("Isolate Name")).toBeInTheDocument();
		expect(screen.getByRole("button")).toBeInTheDocument();
	});

	describe("<IsolateForm />", () => {
		it("should render with source types restricted", async () => {
			renderWithProviders(<CreateIsolate {...props} />);

			await userEvent.click(screen.getByLabelText("Source Type"));

			expect(
				screen.getByRole("option", { name: "Unknown" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Isolate" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("option", { name: "Genotype" }),
			).toBeInTheDocument();
		});

		it("should render with source types unrestricted", () => {
			props.restrictSourceTypes = false;
			renderWithProviders(<CreateIsolate {...props} />);

			expect(
				screen.getByRole("textbox", { name: "Source Type" }),
			).toBeInTheDocument();
			expect(screen.queryByRole("combobox")).toBeNull();
		});

		it.each([
			["Genotype", "A"],
			["unknown", ""],
		])(
			"should handle submit when source type changes to %p",
			async (sourceType, sourceName) => {
				const createIsolate = mockCreateIsolate({ sourceName, sourceType });
				renderWithProviders(<CreateIsolate {...props} />);

				await userEvent.click(screen.getByLabelText("Source Type"));
				await userEvent.click(
					screen.getByRole("option", {
						name: new RegExp(`^${sourceType}$`, "i"),
					}),
				);

				if (sourceName) {
					await userEvent.type(
						screen.getByRole("textbox", { name: "Source Name" }),
						`${sourceName}`,
					);
				}

				await userEvent.click(screen.getByRole("button", { name: "Save" }));

				await waitFor(() =>
					expect(createIsolate).toHaveBeenCalledWith({
						data: {
							otuId: props.otuId,
							default: false,
							sourceName,
							sourceType,
						},
					}),
				);
			},
		);

		it("should handle submit with unrestricted source types", async () => {
			props.restrictSourceTypes = false;
			const createIsolate = mockCreateIsolate({
				sourceName: "testName",
				sourceType: "Test type",
			});
			renderWithProviders(<CreateIsolate {...props} />);

			await userEvent.type(
				screen.getByRole("textbox", { name: "Source Type" }),
				"Test type",
			);
			await userEvent.type(
				screen.getByRole("textbox", { name: "Source Name" }),
				"testName",
			);
			expect(screen.getByRole("textbox", { name: "Isolate Name" })).toHaveValue(
				"Test type testName",
			);

			await userEvent.click(screen.getByRole("button"));

			await waitFor(() =>
				expect(createIsolate).toHaveBeenCalledWith({
					data: {
						otuId: props.otuId,
						default: false,
						sourceName: "testName",
						sourceType: "Test type",
					},
				}),
			);
		});
	});
});
