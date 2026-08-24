import { BoxGroupSection } from "@base/Box";
import type { ReactNode } from "react";

type ListHeaderProps = {
	/** Actions that apply to the list, aligned against its right edge */
	children?: ReactNode;

	/** What the list holds — a count, or what is selected within it */
	label: ReactNode;
};

/** The bar above a paginated list, describing it and holding its actions. */
export default function ListHeader({ children, label }: ListHeaderProps) {
	return (
		<BoxGroupSection className="flex items-center gap-4 h-14 py-0 bg-gray-50 text-sm font-medium text-gray-600">
			<span>{label}</span>
			{children ? (
				<div className="ml-auto flex items-center gap-2">{children}</div>
			) : null}
		</BoxGroupSection>
	);
}
