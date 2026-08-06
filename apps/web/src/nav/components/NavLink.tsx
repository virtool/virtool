import { cn } from "@app/cn";
import { useMatchPartialPath } from "@app/useMatchPartialPath";
import Link from "@base/Link";
import type { ReactNode } from "react";

type NavLinkProps = {
	/** Accessible name, where the children do not read as one — e.g. the logo. */
	ariaLabel?: string;
	children: ReactNode;
	search?: Record<string, string>;
	to: string;
};

const baseClassName = cn(
	"flex",
	"focus-visible:outline-none",
	"focus-visible:ring-2",
	"focus-visible:ring-offset-2",
	"focus-visible:ring-offset-virtool",
	"focus-visible:ring-white",
	"font-medium",
	"hover:bg-black/10",
	"items-center",
	"justify-center",
	"px-3",
	"py-1",
	"rounded-md",
	"text-lg",
	"text-white",
	"transition-colors",
);

const activeClassName = cn(
	baseClassName,
	"bg-white",
	"hover:bg-white",
	"text-virtool-dark",
);

export function NavLink({ ariaLabel, children, search, to }: NavLinkProps) {
	const active = useMatchPartialPath(to);

	return (
		<Link
			aria-label={ariaLabel}
			className={active ? activeClassName : baseClassName}
			search={search}
			to={to}
		>
			{children}
		</Link>
	);
}
