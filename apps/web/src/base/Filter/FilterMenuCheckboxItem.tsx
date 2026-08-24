import { DropdownMenuCheckboxItem } from "@base/Dropdown";
import type { ComponentPropsWithRef } from "react";

type FilterMenuCheckboxItemProps = Omit<
	ComponentPropsWithRef<typeof DropdownMenuCheckboxItem>,
	"onSelect"
>;

/**
 * One option of a {@link FilterMenuContent}.
 *
 * Toggling it leaves the menu open, so several filters can be picked without
 * reopening it between each.
 */
export default function FilterMenuCheckboxItem(
	props: FilterMenuCheckboxItemProps,
) {
	return (
		<DropdownMenuCheckboxItem onSelect={(e) => e.preventDefault()} {...props} />
	);
}
