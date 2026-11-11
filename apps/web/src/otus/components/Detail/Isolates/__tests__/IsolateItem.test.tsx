import { formatIsolateName } from "@app/utils";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtuIsolate } from "@tests/fake/otus";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import IsolateItem from "../IsolateItem";

type IsolateItemProps = ComponentProps<typeof IsolateItem>;

async function renderIsolateItem(props: Partial<IsolateItemProps> = {}) {
	const isolate = props.isolate ?? createFakeOtuIsolate();

	await renderWithRouter(
		<IsolateItem
			isolate={isolate}
			refId="ref-1"
			otuId="otu-1"
			canDelete
			onDelete={vi.fn()}
			onSelect={vi.fn()}
			selected={false}
			{...props}
		/>,
	);

	return screen.getByRole("link", {
		name: new RegExp(`^${RegExp.escape(formatIsolateName(isolate))}`),
	});
}

describe("<IsolateItem />", () => {
	it("links to the isolate and marks the default isolate", async () => {
		const isolate = { ...createFakeOtuIsolate(), default: true };

		const link = await renderIsolateItem({ isolate });

		expect(link).toHaveAttribute(
			"href",
			`/refs/ref-1/otus/otu-1/isolates/${isolate.id}`,
		);
		expect(link).toHaveAccessibleName(
			`${formatIsolateName(isolate)} Default isolate`,
		);
	});

	it("shows no default marker or delete control when neither applies", async () => {
		const isolate = { ...createFakeOtuIsolate(), default: false };

		const link = await renderIsolateItem({ isolate, canDelete: false });

		expect(link).toHaveAccessibleName(formatIsolateName(isolate));
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("reports delete and select clicks", async () => {
		const isolate = createFakeOtuIsolate();
		const onDelete = vi.fn();
		const onSelect = vi.fn();

		await renderIsolateItem({ isolate, onDelete, onSelect });

		await userEvent.click(
			screen.getByRole("button", { name: "Delete isolate" }),
		);
		await userEvent.click(
			screen.getByRole("checkbox", {
				name: `Select ${formatIsolateName(isolate)}`,
			}),
		);

		expect(onDelete).toHaveBeenCalledWith(isolate);
		expect(onSelect).toHaveBeenCalledOnce();
	});
});
