import { cn } from "@app/cn";
import type { ReactNode } from "react";

type ViewHeaderTitleProps = {
	children: ReactNode;
	className?: string;
};

function ViewHeaderTitle({ children, className }: ViewHeaderTitleProps) {
	return (
		<h1
			className={cn(
				"flex items-center min-h-10 text-3xl font-bold m-0",
				className,
			)}
		>
			{children}
		</h1>
	);
}

ViewHeaderTitle.displayName = "ViewHeaderTitle";

export default ViewHeaderTitle;
