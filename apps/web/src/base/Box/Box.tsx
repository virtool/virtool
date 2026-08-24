import { cn } from "@app/cn";
import type { AriaRole, ElementType, KeyboardEvent, ReactNode } from "react";

type BoxProps = {
	as?: ElementType;
	children: ReactNode;
	className?: string;
	id?: string;
	role?: AriaRole;
	"aria-labelledby"?: string;
	"aria-multiselectable"?: boolean;
	onClick?: () => void;
};

function Box({
	as: Component = "div",
	children,
	className = "",
	onClick,
	...rest
}: BoxProps) {
	const interactiveProps = onClick
		? {
				onClick,
				onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onClick();
					}
				},
				role: "button",
				tabIndex: 0,
			}
		: {};

	return (
		<Component
			className={cn(
				{ "hover:bg-gray-100": onClick },
				"border-1",
				"border-gray-300",
				{ "cursor-pointer": onClick },
				"mb-6",
				"py-4",
				"px-4",
				"relative",
				"rounded-sm",
				className,
			)}
			{...rest}
			{...interactiveProps}
		>
			{children}
		</Component>
	);
}

export default Box;
