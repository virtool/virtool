import { cn } from "@app/cn";
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

	/** The group title, which triggers ``menu``. */
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
	title,
}: FilterGroupProps) {
	const shell = (
		<div className="flex items-stretch overflow-hidden rounded-md border border-gray-300 bg-white text-sm">
			{menu ? (
				<DropdownMenuTrigger
					className={cn(titleClassName, "hover:bg-gray-100")}
				>
					{icon}
					{title}
				</DropdownMenuTrigger>
			) : (
				<span className={titleClassName}>
					{icon}
					{title}
				</span>
			)}
			{children}
		</div>
	);

	if (!menu) {
		return shell;
	}

	return (
		// Non-modal so the group's chips stay visible and clickable while its menu
		// is open. A modal menu would `aria-hidden` them along with the rest of the
		// page.
		<Dropdown modal={false}>
			{shell}
			{menu}
		</Dropdown>
	);
}
