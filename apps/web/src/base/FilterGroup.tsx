import { cn } from "@app/cn";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import Dropdown from "./Dropdown";
import DropdownMenuTrigger from "./DropdownMenuTrigger";

const titleClassName =
	"flex items-center gap-1.5 px-2 py-0.5 font-medium text-gray-500";

type FilterGroupProps = {
	/** Chips for the filters that are active in this group. */
	children?: ReactNode;

	/** An icon shown left of the group title. */
	icon: ReactNode;

	/** The menu opened by the group title. Omit to make the title inert. */
	menu?: ReactNode;

	/**
	 * The popover opened by the group title, for a panel whose own arrow-key
	 * navigation a menu would swallow. Mutually exclusive with `menu`.
	 */
	popover?: ReactNode;

	/** The group title, which triggers `menu` or `popover`. */
	title: string;
};

/**
 * One filter of a {@link FilterBar}: a titled button opening a menu, followed
 * by a chip for each of its active filters.
 */
export default function FilterGroup({
	children,
	icon,
	menu,
	popover,
	title,
}: FilterGroupProps) {
	function renderTrigger() {
		if (menu) {
			return (
				<DropdownMenuTrigger
					className={cn(titleClassName, "hover:bg-gray-100")}
				>
					{icon}
					{title}
				</DropdownMenuTrigger>
			);
		}

		if (popover) {
			return (
				<Popover.Trigger
					className={cn(titleClassName, "cursor-pointer hover:bg-gray-100")}
				>
					{icon}
					{title}
				</Popover.Trigger>
			);
		}

		return (
			<span className={titleClassName}>
				{icon}
				{title}
			</span>
		);
	}

	const shell = (
		<div className="flex items-stretch overflow-hidden rounded-md border border-gray-300 bg-white text-sm">
			{renderTrigger()}
			{children}
		</div>
	);

	// Non-modal so the group's chips stay visible and clickable while its panel is
	// open. A modal one would `aria-hidden` them along with the rest of the page.
	if (menu) {
		return (
			<Dropdown modal={false}>
				{shell}
				{menu}
			</Dropdown>
		);
	}

	if (popover) {
		return (
			<Popover.Root modal={false}>
				{shell}
				{popover}
			</Popover.Root>
		);
	}

	return shell;
}
