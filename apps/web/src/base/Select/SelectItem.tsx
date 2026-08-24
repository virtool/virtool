import { cn } from "@app/cn";
import { selectItemStateClasses } from "@base/styles";
import { Check } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ReactNode } from "react";

/** Props for the Select item check mark. */
type SelectItemIndicatorProps = {
	/**
	 * Vertical placement classes. Defaults to centering on the item, which is
	 * correct for single-line items. Items that render more than one line pass
	 * an offset and height matching their first line instead.
	 */
	className?: string;
};

/**
 * The check mark shown on the currently-selected Select item. Positioned in the
 * left gutter that every Select item reserves with `pl-6`.
 */
export function SelectItemIndicator({
	className = "top-1/2 -translate-y-1/2",
}: SelectItemIndicatorProps) {
	return (
		<SelectPrimitive.ItemIndicator
			className={cn(
				"absolute left-1.5 inline-flex items-center text-blue-500",
				className,
			)}
		>
			<Check size={14} />
		</SelectPrimitive.ItemIndicator>
	);
}

/** Props for the shared Select item. */
type SelectItemProps = {
	/** The item's label, rendered as the selected value on the trigger. */
	children: ReactNode;
	/** Extra classes merged onto the item, e.g. `normal-case` to opt out of the default capitalization. */
	className?: string;
	/** An optional description rendered on a second line beneath the label. */
	description?: string;
	/** The value committed to the Select when the item is chosen. */
	value: string;
};

export default function SelectItem({
	value,
	children,
	className,
	description,
}: SelectItemProps) {
	return (
		<SelectPrimitive.Item
			className={cn(
				"font-medium flex flex-col items-start py-1.5 pr-9 pl-6 capitalize",
				selectItemStateClasses,
				className,
			)}
			data-slot="select-item"
			value={value}
			key={value}
		>
			<SelectItemIndicator className="top-1.5 h-6" />
			<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
			{description && (
				<div className="text-xs font-normal text-gray-600 mt-1 whitespace-pre-wrap">
					{description}
				</div>
			)}
		</SelectPrimitive.Item>
	);
}
