import { act, renderHook } from "@testing-library/react";
import { at } from "@tests/setup";
import { describe, expect, it } from "vitest";
import { useListSelection } from "../useListSelection";

type Item = { id: number; name: string };

function makeItems(count: number): Item[] {
	return Array.from({ length: count }, (_unused, index) => ({
		id: index + 1,
		name: `Item ${index + 1}`,
	}));
}

function setup(resetKey?: unknown) {
	return renderHook(
		(props: { resetKey?: unknown }) =>
			useListSelection<Item>({
				getKey: (item) => item.id,
				resetKey: props.resetKey,
			}),
		{ initialProps: { resetKey } },
	);
}

function selectedIds(selectedKeys: Set<string | number>): number[] {
	return [...selectedKeys].map(Number).sort((a, b) => a - b);
}

describe("useListSelection()", () => {
	it("starts with an empty selection", () => {
		const { result } = setup();

		expect(result.current.selected).toEqual([]);
		expect(result.current.selectedKeys.size).toBe(0);
	});

	it("toggles a single item on and off", () => {
		const items = makeItems(3);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		expect(result.current.isSelected(at(items, 0))).toBe(true);
		expect(result.current.selected).toHaveLength(1);

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		expect(result.current.isSelected(at(items, 0))).toBe(false);
		expect(result.current.selected).toHaveLength(0);
	});

	it("treats a shift-click with no anchor as a plain toggle", () => {
		const items = makeItems(3);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 1), {
				shiftKey: true,
				visibleItems: items,
			});
		});

		expect(result.current.isSelected(at(items, 1))).toBe(true);
		expect(result.current.selected).toHaveLength(1);
	});

	it("selects a contiguous range on a forward shift-click", () => {
		const items = makeItems(4);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: true,
				visibleItems: items,
			});
		});

		expect(selectedIds(result.current.selectedKeys)).toEqual([1, 2, 3]);
	});

	it("selects the same range on a backward shift-click", () => {
		const items = makeItems(4);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: true,
				visibleItems: items,
			});
		});

		expect(selectedIds(result.current.selectedKeys)).toEqual([1, 2, 3]);
	});

	it("deselects a range when the shift-clicked row is already selected", () => {
		const items = makeItems(3);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: true,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: true,
				visibleItems: items,
			});
		});

		expect(result.current.selected).toHaveLength(0);
	});

	it("re-anchors on the most recently shift-clicked row", () => {
		const items = makeItems(5);
		const { result } = setup();

		// Select every row, moving the anchor to the last row.
		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.select(at(items, 4), {
				shiftKey: true,
				visibleItems: items,
			});
		});

		// Shift-clicking a selected middle row deselects the range up to the anchor
		// (the last row), not back to the original first-row anchor.
		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: true,
				visibleItems: items,
			});
		});

		expect(selectedIds(result.current.selectedKeys)).toEqual([1, 2]);
	});

	it("falls back to a plain toggle when the anchor is not visible", () => {
		const page = makeItems(5);
		const offPage = [
			{ id: 6, name: "Item 6" },
			{ id: 7, name: "Item 7" },
		];
		const { result } = setup();

		act(() => {
			result.current.select(at(page, 0), {
				shiftKey: false,
				visibleItems: page,
			});
		});
		act(() => {
			result.current.select(at(offPage, 1), {
				shiftKey: true,
				visibleItems: offPage,
			});
		});

		expect(selectedIds(result.current.selectedKeys)).toEqual([1, 7]);
	});

	it("selects and clears all visible items, leaving off-page selections", () => {
		const items = makeItems(3);
		const offPage: Item = { id: 99, name: "Item 99" };
		const { result } = setup();

		act(() => {
			result.current.setSelected([offPage]);
		});
		act(() => {
			result.current.toggleVisible(items);
		});
		expect(selectedIds(result.current.selectedKeys)).toEqual([1, 2, 3, 99]);

		act(() => {
			result.current.toggleVisible(items);
		});
		expect(result.current.selected).toEqual([offPage]);
	});

	it("completes the selection when only some visible items are selected", () => {
		const items = makeItems(3);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.toggleVisible(items);
		});

		expect(result.current.selected).toHaveLength(3);
	});

	it("reports the tri-state of the visible items", () => {
		const items = makeItems(3);
		const { result } = setup();

		expect(result.current.getVisibleState(items)).toBe(false);

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		expect(result.current.getVisibleState(items)).toBe("indeterminate");

		act(() => {
			result.current.toggleVisible(items);
		});
		expect(result.current.getVisibleState(items)).toBe(true);
	});

	it("resets the selection and anchor when the reset key changes", () => {
		const items = makeItems(3);
		const { result, rerender } = setup("a");

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: true,
				visibleItems: items,
			});
		});
		expect(result.current.selected).toHaveLength(3);

		rerender({ resetKey: "b" });
		expect(result.current.selected).toEqual([]);

		// A shift-click now has no anchor, so it behaves as a plain toggle.
		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: true,
				visibleItems: items,
			});
		});
		expect(result.current.selected).toHaveLength(1);
	});

	it("clears the selection and anchor", () => {
		const items = makeItems(3);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.clear();
		});
		expect(result.current.selected).toEqual([]);

		act(() => {
			result.current.select(at(items, 2), {
				shiftKey: true,
				visibleItems: items,
			});
		});
		expect(result.current.selected).toHaveLength(1);
	});

	it("keeps key-based dedupe after patching items via setSelected", () => {
		const items = makeItems(2);
		const { result } = setup();

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		act(() => {
			result.current.setSelected((previous) =>
				previous.map((item) => ({ ...item, name: "Patched" })),
			);
		});
		expect(at(result.current.selected, 0).name).toBe("Patched");

		act(() => {
			result.current.select(at(items, 0), {
				shiftKey: false,
				visibleItems: items,
			});
		});
		expect(result.current.isSelected(at(items, 0))).toBe(false);
	});
});
