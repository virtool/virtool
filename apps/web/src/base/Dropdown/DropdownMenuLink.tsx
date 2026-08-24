import Link from "@base/Link";
import type { ReactNode } from "react";
import DropdownMenuItem from "./DropdownMenuItem";

type DropdownMenuLinkProps = {
	children: ReactNode;
	className?: string;
	to: string;
	target?: string;
	rel?: string;
};

export default function DropdownMenuLink({
	children,
	className,
	to,
	target,
	rel,
}: DropdownMenuLinkProps) {
	return (
		<DropdownMenuItem className={className} asChild>
			<Link to={to} target={target} rel={rel}>
				{children}
			</Link>
		</DropdownMenuItem>
	);
}
