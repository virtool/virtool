import { cn } from "@app/cn";
import Icon from "@base/Icon";
import { ChevronDown } from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/**
 * A disclosure that shows and hides its content. Control it with `open` and
 * `onOpenChange`.
 */
export const Collapsible = CollapsiblePrimitive.Root;

/** Props for the control that opens and closes a collapsible. */
export type CollapsibleTriggerProps = ComponentProps<
	typeof CollapsiblePrimitive.Trigger
>;

/**
 * The control that opens and closes a collapsible. Its chevron points down when
 * the content is hidden and up when it is shown.
 */
export function CollapsibleTrigger({
	children,
	className,
	...props
}: CollapsibleTriggerProps) {
	return (
		<CollapsiblePrimitive.Trigger
			className={cn(
				"group",
				"inline-flex",
				"items-center",
				"gap-1.5",
				"bg-transparent",
				"border-none",
				"cursor-pointer",
				"p-0",
				"rounded",
				"font-medium",
				"text-gray-600",
				"text-sm",
				"hover:text-gray-800",
				"focus-visible:ring-2",
				"focus-visible:ring-blue-500",
				"focus-visible:outline-none",
				className,
			)}
			{...props}
		>
			<Icon
				className="transition-transform group-data-[state=open]:rotate-180 size-4"
				icon={ChevronDown}
			/>
			{children}
		</CollapsiblePrimitive.Trigger>
	);
}

/** Props for the content a collapsible shows and hides. */
export type CollapsibleContentProps = ComponentProps<
	typeof CollapsiblePrimitive.Content
>;

/**
 * The content a collapsible shows and hides. It is unmounted while closed.
 */
export function CollapsibleContent({
	className,
	...props
}: CollapsibleContentProps) {
	return (
		<CollapsiblePrimitive.Content
			className={cn("overflow-hidden", className)}
			{...props}
		/>
	);
}
