import { cn } from "@app/cn";
import { type BarColor, bgColorClasses } from "./colors";

type BarItemProps = {
	color?: BarColor;
	empty?: boolean;
	size: number;
};

function BarItem({ color, empty, size }: BarItemProps) {
	return (
		<div
			className={cn(
				empty ? "bg-white shadow-inner" : color && bgColorClasses[color],
			)}
			style={{ flex: `${size / 100} 0 auto` }}
		/>
	);
}

/** A single coloured segment in a {@link Bars} chart */
export type BarsItem = {
	color: BarColor;
	count: number;
};

type BarsProps = {
	/** The count left uncoloured at the end of the bar. */
	empty?: number;

	items: BarsItem[];

	/** Describes the bar to readers who can't see it. */
	label: string;
};

export function Bars({ empty = 0, items, label }: BarsProps) {
	const emptySize = Math.max(0, empty);

	return (
		<div
			aria-label={label}
			className="flex h-6 overflow-hidden border border-gray-300 rounded-md"
			role="img"
		>
			{items.map(({ color, count }) => (
				<BarItem key={color} color={color} size={count} />
			))}
			{emptySize > 0 && <BarItem empty size={emptySize} />}
		</div>
	);
}
