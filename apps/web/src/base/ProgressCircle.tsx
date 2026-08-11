import { cn } from "@app/cn";
import type { JobState } from "@virtool/contracts";
import { Progress } from "radix-ui";

const colorToVar: Record<string, string> = {
	blue: "var(--color-blue-600)",
	blueLightest: "var(--color-blue-100)",
	green: "var(--color-green-600)",
	greenLightest: "var(--color-green-100)",
	gray: "var(--color-gray-400)",
	grayLight: "var(--color-gray-300)",
	red: "var(--color-red-600)",
	redLightest: "var(--color-red-100)",
};

/** Diameter of the progress circle in viewBox user units. */
const circleSize = 20;

function calculateStrokeWidth(size: number): number {
	return size / 5;
}

function calculateRadius(size: number): number {
	return size / 2 - calculateStrokeWidth(size);
}

function calculateCircumference(size: number): number {
	return calculateRadius(size) * Math.PI * 2;
}

function calculateStrokeDashOffset(size: number, progress: number): number {
	return (1 - progress) * calculateCircumference(size);
}

function getProgressColor(state: JobState): string {
	switch (state) {
		case "succeeded":
			return "green";
		case "running":
			return "blue";
		case "pending":
			return "gray";
		default:
			return "red";
	}
}

function getTrackColor(color: string): string {
	const fallback = colorToVar.grayLight ?? "var(--color-gray-300)";

	if (color === "gray") {
		return fallback;
	}
	return colorToVar[`${color}Lightest`] ?? fallback;
}

type ProgressCircleProps = {
	progress: number;
	state?: JobState;
};

export default function ProgressCircle({
	progress,
	state = "pending",
}: ProgressCircleProps) {
	const color = getProgressColor(state);
	const radius = calculateRadius(circleSize);
	const strokeWidth = calculateStrokeWidth(circleSize);
	const circumference = calculateCircumference(circleSize);
	const center = circleSize / 2;

	const baseCircleStyle = {
		cx: center,
		cy: center,
		r: radius,
		fill: "transparent",
		strokeWidth,
		strokeDasharray: circumference,
	};

	// One interpolated child, never `Progress: {progress}%`. That form is three
	// children, and React's server renderer emits an empty `<title>` for
	// anything but a single string — so the browser fills it in at hydration and
	// the mismatch throws away this page's server markup.
	const title = `Progress: ${progress}%`;

	return (
		<Progress.Root value={progress} asChild>
			<svg
				className="-rotate-90 size-6"
				viewBox={`0 0 ${circleSize} ${circleSize}`}
			>
				<title>{title}</title>
				<circle
					{...baseCircleStyle}
					className={cn(
						"transition-[stroke-dashoffset,stroke] duration-1000",
						state === "pending" && "animate-rotate",
					)}
					stroke={getTrackColor(color)}
					strokeDashoffset={
						state === "pending"
							? calculateStrokeDashOffset(circleSize, 0.75)
							: 0
					}
					style={{
						transformBox: "fill-box",
						transformOrigin: "center",
						animationPlayState: state === "pending" ? "running" : "paused",
					}}
				/>
				{state === "running" && (
					<circle
						cx={center}
						cy={center}
						r={radius / 2.5}
						fill={colorToVar.blue}
						className="animate-fade"
						style={{
							vectorEffect: "non-scaling-stroke",
							transformBox: "fill-box",
							transformOrigin: "center",
						}}
					/>
				)}
				<Progress.Indicator asChild>
					<circle
						{...baseCircleStyle}
						className="transition-[stroke-dashoffset,stroke] duration-1000"
						stroke={colorToVar[color]}
						strokeDashoffset={calculateStrokeDashOffset(
							circleSize,
							progress / 100,
						)}
					/>
				</Progress.Indicator>
			</svg>
		</Progress.Root>
	);
}
