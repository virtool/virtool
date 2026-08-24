import { cn } from "@app/cn";
import Icon from "@base/Icon";
import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentPropsWithRef } from "react";

/**
 * Button for toggling the display of accordion contents, with a chevron that
 * points down while the item is closed and up while it is open.
 *
 * Wrapped in the primitive's header, which renders an `h3` — the ARIA accordion
 * pattern puts every trigger in a heading so the list can be navigated by
 * heading rather than only by tabbing through it.
 *
 * The trigger carries the item's title and nothing else. A trigger spanning the
 * whole summary row reads every figure in that row out as part of one button
 * name, bars the row from holding a control or a labelled graphic of its own —
 * a `button` may not contain another — and limits it to phrasing content, since
 * a `button` may not contain a `div` either. Everything else the summary shows
 * is a sibling of this inside the item.
 *
 * `text-left` undoes the `text-align: center` a browser applies to every
 * button, which preflight does not reset.
 */
export default function AccordionTrigger({
	children,
	className,
	...props
}: ComponentPropsWithRef<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="m-0 min-w-0">
			<AccordionPrimitive.Trigger
				className={cn(
					"group inline-flex items-center gap-1.5 max-w-full min-w-0",
					"bg-transparent border-none cursor-pointer p-0 rounded-sm text-left",
					"hover:text-gray-700",
					"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
					className,
				)}
				{...props}
			>
				<Icon
					className="shrink-0 size-4 transition-transform group-data-[state=open]:rotate-180"
					icon={ChevronDown}
				/>
				{children}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}
