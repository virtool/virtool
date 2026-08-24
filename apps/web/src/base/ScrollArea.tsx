import { cn } from "@app/cn";
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type ScrollAreaProps = {
	children: ReactNode;
	className?: string;
};

/**
 * A styled scrollable area compatible with horizontal and vertical scrolling
 */
export default function ScrollArea({ children, className }: ScrollAreaProps) {
	return (
		<ScrollAreaPrimitive.Root
			className={cn(
				"w-[240px]",
				"h-[420px]",
				"rounded",
				"overflow-hidden",
				"p-0",
				"flex-none",
				"mr-4",
				"border",
				"border-gray-300",
				className,
			)}
		>
			<ScrollAreaPrimitive.Viewport className={cn("w-full", "h-full rounded")}>
				{children}
			</ScrollAreaPrimitive.Viewport>
			<ScrollAreaPrimitive.Scrollbar
				className={cn(
					"flex",
					"select-none",
					"touch-none",
					"p-0.5",
					"bg-gray-100",
					"transition-colors",
					"duration-150",
					"ease-out",
					"hover:bg-gray-200",
					"data-[orientation=vertical]:w-2.5",
					"data-[orientation=horizontal]:flex-col",
					"data-[orientation=horizontal]:h-2.5",
				)}
				orientation="vertical"
			>
				<ScrollAreaPrimitive.Thumb
					className={cn(
						"flex-1",
						"bg-gray-400",
						"rounded-[10px]",
						"relative",
						"before:content-['']",
						"before:absolute",
						"before:top-1/2",
						"before:left-1/2",
						"before:-translate-x-1/2",
						"before:-translate-y-1/2",
						"before:w-full",
						"before:h-full",
						"before:min-w-[44px]",
						"before:min-h-[44px]",
					)}
				/>
			</ScrollAreaPrimitive.Scrollbar>
			<ScrollAreaPrimitive.Scrollbar
				className={cn(
					"flex",
					"select-none",
					"touch-none",
					"p-0.5",
					"bg-gray-100",
					"transition-colors",
					"duration-150",
					"ease-out",
					"hover:bg-gray-200",
					"data-[orientation=vertical]:w-2.5",
					"data-[orientation=horizontal]:flex-col",
					"data-[orientation=horizontal]:h-2.5",
				)}
				orientation="horizontal"
			>
				<ScrollAreaPrimitive.Thumb
					className={cn(
						"flex-1",
						"bg-gray-400",
						"rounded-[10px]",
						"relative",
						"before:content-['']",
						"before:absolute",
						"before:top-1/2",
						"before:left-1/2",
						"before:-translate-x-1/2",
						"before:-translate-y-1/2",
						"before:w-full",
						"before:h-full",
						"before:min-w-[44px]",
						"before:min-h-[44px]",
					)}
				/>
			</ScrollAreaPrimitive.Scrollbar>
			<ScrollAreaPrimitive.Corner className="bg-gray-200" />
		</ScrollAreaPrimitive.Root>
	);
}
