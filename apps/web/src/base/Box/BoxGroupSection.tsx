import { cn } from "@app/cn";
import type { ElementType, KeyboardEvent, ReactNode, Ref } from "react";

type BoxGroupSectionProps = {
	"aria-selected"?: boolean;
	as?: ElementType;
	children?: ReactNode;
	className?: string;
	id?: string;
	onClick?: () => void;
	onKeyDown?: (e: KeyboardEvent) => void;
	ref?: Ref<HTMLDivElement>;
	role?: string;
	style?: React.CSSProperties;
	tabIndex?: number;
};

export default function BoxGroupSection({
	as: Component = "div",
	children,
	className = "",
	...props
}: BoxGroupSectionProps) {
	return (
		<Component
			className={cn(
				"bg-transparent",
				"block",
				"border-gray-300",
				"not-last:border-b-1",
				"py-3",
				"px-6",
				"relative",
				"text-inherit",
				"w-full",
				className,
			)}
			{...props}
		>
			{children}
		</Component>
	);
}
