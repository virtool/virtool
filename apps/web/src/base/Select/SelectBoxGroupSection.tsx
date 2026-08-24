import { cn } from "@app/cn";
import { BoxGroupSection } from "@base/Box";
import type { ReactNode } from "react";

type SelectBoxGroupSectionProps = {
	/** Whether the option is selected */
	active?: boolean;
	children: ReactNode;
	className?: string;
	/** Whether the option is the keyboard cursor's active descendant */
	highlighted?: boolean;
	/** The option's DOM id, referenced by the listbox's `aria-activedescendant` */
	id?: string;
	onClick?: () => void;
};

/**
 * A single option in a listbox.
 *
 * The parent listbox owns keyboard focus and moves an `aria-activedescendant`
 * cursor, so options are not individually focusable — `highlighted` renders the
 * cursor and `active` reflects selection.
 */
export default function SelectBoxGroupSection({
	active,
	children,
	className,
	highlighted,
	id,
	onClick,
}: SelectBoxGroupSectionProps) {
	return (
		<BoxGroupSection
			aria-selected={active}
			className={cn(
				"cursor-pointer",
				"w-full",
				active && "bg-blue-50",
				highlighted && "ring-2 ring-inset ring-blue-600/50",
				className,
			)}
			id={id}
			onClick={onClick}
			role="option"
		>
			{children}
		</BoxGroupSection>
	);
}
