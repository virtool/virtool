import { cn } from "@app/cn";
import { useMatchPartialPath } from "@app/useMatchPartialPath";
import Link from "@base/Link";
import type { ReactNode } from "react";

type NavTabProps = {
	children: ReactNode;
	className?: string;
	isActive?: boolean;
	search?: Record<string, unknown>;
	to: string;
};

/**
 * A navigation link with active state styling
 */
export default function NavTab({
	children,
	className,
	isActive,
	search,
	to,
}: NavTabProps) {
	isActive = useMatchPartialPath(to) || isActive;

	const classname = cn(
		"text-lg",
		"text-center",
		"font-medium",
		"py-2.5",
		"px-4",
		"-mb-px",
		"border-b-2",
		"border-b-transparent",
		"hover:border-b-gray-400",
		className,
	);

	return (
		<Link
			className={
				isActive
					? cn(classname, "border-b-teal-700", "hover:border-b-teal-700")
					: classname
			}
			search={search}
			to={to}
		>
			{children}
		</Link>
	);
}
