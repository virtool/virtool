import { cn } from "@app/cn";
import type { ReactNode } from "react";

type ViewHeaderProps = {
	children?: ReactNode;
	className?: string;
	title: string;
};

export default function ViewHeader({
	className,
	title,
	children,
}: ViewHeaderProps) {
	return (
		<header className={cn("mt-2.5 mb-5", className)}>
			<title>{title}</title>
			{children}
		</header>
	);
}
