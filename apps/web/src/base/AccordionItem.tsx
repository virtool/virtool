import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ReactNode } from "react";

type AccordionItemProps = {
	children: ReactNode;

	/** The identifying value associated with the item */
	value: string;
};

/** One item of an accordion, in a border of its own */
export default function AccordionItem({ value, children }: AccordionItemProps) {
	return (
		<AccordionPrimitive.Item
			className="border border-gray-300 mb-2.5 overflow-hidden rounded-sm"
			value={value}
		>
			{children}
		</AccordionPrimitive.Item>
	);
}
