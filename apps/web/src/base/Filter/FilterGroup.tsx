import { cn } from "@app/cn";
import Dropdown, { DropdownMenuTrigger } from "@base/Dropdown";
import { Popover } from "radix-ui";
import type { ReactNode } from "react";

const titleClassName =
	"flex items-center gap-1.5 px-2 py-0.5 font-medium text-gray-500";

type FilterGroupBaseProps = {
	/** Chips for the filters that are active in this group. */
	children?: ReactNode;

	/** An icon shown left of the group title. */
	icon: ReactNode;

	/** The group title, which triggers `menu` or `popover`. */
	title: string;
};

/**
 * The panel a {@link FilterGroup} title opens, if it opens one at all.
 *
 * A union rather than two optional props, because the render path can only
 * honour one of them: a group given both would silently drop whichever branch
 * lost. Omitting both makes the title inert.
 */
type FilterGroupPanelProps =
	| { menu?: never; popover?: never }
	| {
			/** The menu opened by the group title. */
			menu: ReactNode;
			popover?: never;
	  }
	| {
			menu?: never;

			/**
			 * The popover opened by the group title, for a panel whose own
			 * arrow-key navigation a menu would swallow.
			 */
			popover: ReactNode;
	  };

type FilterGroupProps = FilterGroupBaseProps & FilterGroupPanelProps;

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
