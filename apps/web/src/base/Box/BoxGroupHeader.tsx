import { cn } from "@app/cn";
import type { ReactNode } from "react";
import BoxGroupSection from "./BoxGroupSection";

type BoxGroupHeaderProps = {
	children?: ReactNode;
	className?: string;
};

export default function BoxGroupHeader({
	children,
	className = "",
}: BoxGroupHeaderProps) {
	return (
		<BoxGroupSection
			className={cn(
				"bg-gray-100",
				"flex",
				"flex-col",
				"items-stretch",
				"px-4",
				"pt-4",
				"pb-3",
				"text-sm",
				"[&_h2]:flex",
				"[&_h2]:items-center",
				"[&_h2]:text-base",
				"[&_h2]:font-medium",
				"[&_h2]:m-0",
				"[&_p]:text-gray-600",
				"[&_p]:mt-1",
				"[&_p]:mb-0",
				className,
			)}
		>
			{children}
		</BoxGroupSection>
	);
}
