import { cn } from "@app/cn";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type BaseWorkflowTagProps<T extends ElementType = "div"> = {
	as?: T;
	children: ReactNode;
	className?: string;
};

/**
 * Base workflow tag component.
 *
 * @returns A base WorkflowTag component.
 */
export function BaseWorkflowTag<T extends ElementType = "div">({
	as,
	children,
	className,
	...props
}: BaseWorkflowTagProps<T> &
	Omit<ComponentPropsWithoutRef<T>, keyof BaseWorkflowTagProps<T>>) {
	const Component = as || "div";

	return (
		<Component
			className={cn(
				"flex items-center gap-1.5 text-sm font-bold px-2 py-1.5",
				"first:rounded-l-sm last:rounded-r-sm",
				"[&:not(:last-child)]:border-r [&:not(:last-child)]:border-white/60",
				"[&_svg]:leading-[inherit]",
				className,
			)}
			{...props}
		>
			{children}
		</Component>
	);
}
