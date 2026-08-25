import { cn } from "@app/cn";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

const baseSampleLabelVariants = cva(
	"inline-flex items-center border rounded-md [&_svg]:mr-1 [&_svg]:text-[var(--user-color)]",
	{
		variants: {
			size: {
				sm: "text-sm font-medium px-1.5 py-0.5 [&_svg]:mr-0.5",
				md: "text-base px-2 py-1",
			},
			variant: {
				default: "bg-white border-gray-300",
				library:
					"bg-gray-200 border-gray-300 text-sm font-semibold px-1.5 py-0.5 [&_svg]:mr-0.5",
			},
		},
		defaultVariants: {
			size: "md",
			variant: "default",
		},
	},
);

type BaseSampleLabelProps = VariantProps<typeof baseSampleLabelVariants> & {
	children: ReactNode;
	className?: string;
	color?: string;
	as?: ElementType;
};

/**
 * The base sample label component with variants
 */
export function BaseSampleLabel({
	children,
	className,
	color,
	size,
	variant,
	as: Component = "span",
	...props
}: BaseSampleLabelProps & ComponentPropsWithoutRef<"span" | "button">) {
	const formattedColor = color?.startsWith("#")
		? color
		: color
			? `#${color}`
			: undefined;

	return (
		<Component
			className={cn(baseSampleLabelVariants({ size, variant }), className)}
			style={
				{
					"--user-color": formattedColor,
				} as React.CSSProperties
			}
			{...props}
		>
			{children}
		</Component>
	);
}
