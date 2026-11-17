import Icon from "@base/Icon";
import Link from "@base/Link";
import type { LinkProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AnalysisBadgeProps = {
	children: ReactNode;
	icon: LucideIcon;
	params: LinkProps["params"];
	to: LinkProps["to"];
};

/** A linked pill naming a reference or subtraction used by an analysis. */
export default function AnalysisBadge({
	children,
	icon,
	params,
	to,
}: AnalysisBadgeProps) {
	return (
		<Link
			className="group text-gray-700 hover:text-gray-900 focus-visible:text-gray-900"
			params={params}
			to={to}
		>
			<span className="inline-flex items-center gap-1 rounded-md border border-transparent bg-gray-100 px-1.5 py-0.5 text-sm font-medium group-hover:bg-gray-200 group-focus-visible:bg-gray-200">
				<Icon className="size-4" icon={icon} strokeWidth={1.5} />
				<span>{children}</span>
			</span>
		</Link>
	);
}
