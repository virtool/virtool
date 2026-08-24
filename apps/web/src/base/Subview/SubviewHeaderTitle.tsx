import { cn } from "@app/cn";
import type { ReactNode } from "react";

type SubviewHeaderTitleProps = {
	children?: ReactNode;
	className?: string;
};

export default function SubviewHeaderTitle({
	children,
	className,
}: SubviewHeaderTitleProps) {
	return (
		<h2 className={cn("text-2xl font-bold m-0", className)}>{children}</h2>
	);
}
