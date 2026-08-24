import { cn } from "@app/cn";

const iconSize = {
	xs: "12px",
	sm: "16px",
	md: "20px",
	lg: "28px",
	xl: "44px",
	xxl: "60px",
};

const fontSize = {
	xs: "6px",
	sm: "8px",
	md: "10px",
	lg: "14px",
	xl: "22px",
	xxl: "30px",
};

function hashColor(hash: number, newChar: string) {
	return (hash << 5) - newChar.charCodeAt(0);
}

type InitialIconProps = {
	className?: string;
	handle: string;
	size: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
};

export default function InitialIcon({
	className,
	handle,
	size,
}: InitialIconProps) {
	const hash = handle.split("").reduce(hashColor, 0) % 360;
	const sizeValue = iconSize[size];
	const fontSizeValue = fontSize[size];

	return (
		<svg
			role="img"
			aria-label={handle}
			className={cn("overflow-visible", className)}
			style={{ height: sizeValue, width: sizeValue }}
		>
			<circle
				cx={fontSizeValue}
				cy={fontSizeValue}
				r={fontSizeValue}
				fill={`hsl(${hash}, 83%, 21%)`}
			/>
			<text
				x="1em"
				y="1em"
				dy=".35em"
				textAnchor="middle"
				fill="white"
				fontSize={fontSizeValue}
				fontWeight="bold"
			>
				{handle.slice(0, 2).toUpperCase()}
			</text>
		</svg>
	);
}
