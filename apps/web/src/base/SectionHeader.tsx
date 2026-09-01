import { cn } from "@app/cn";
import type { ReactNode } from "react";

type SectionHeaderProps = {
	children: ReactNode;
	className?: string;
	/** "2xl" for page titles, "lg" for section titles */
	size?: "lg" | "2xl";
};

export default function SectionHeader({
	children,
	className = "",
	size = "lg",
}: SectionHeaderProps) {
	return (
		<header
			className={cn(
				size === "2xl"
					? ["mb-5", "[&_h2]:mb-1.5", "[&_h2]:text-2xl", "[&_p]:text-base"]
					: ["mb-4", "[&_h2]:mb-1", "[&_h2]:text-lg", "[&_p]:text-sm"],
				"[&_p]:text-gray-600",
				"[&_p]:font-medium",
				className,
			)}
		>
			{children}
		</header>
	);
}
