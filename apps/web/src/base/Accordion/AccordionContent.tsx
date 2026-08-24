import { cn } from "@app/cn";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/** display the content of the accordion dropdown based on state */
export default function AccordionContent({
	className,
	...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			className={cn(
				"overflow-hidden px-4 data-[state=closed]:hidden",
				className,
			)}
			{...props}
		/>
	);
}
