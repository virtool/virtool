import { useElementSize, useRootFontSize } from "@app/hooks";
import Icon from "@base/Icon";
import Popover from "@base/Popover";
import Tooltip from "@base/Tooltip";
import type { Coordinate } from "@virtool/contracts";
import { Mountain } from "lucide-react";
import type { ReactNode } from "react";
import { buildDepthPath } from "./coverage";

/** The horizontal space left between one panel and the next. */
const gap = 6;

/** The horizontal space left between the outermost panels and the border. */
const gutter = 4;

/**
 * The height reserved for the label row, whether or not a given panel has
 * text to put there.
 *
 * Reserving it unconditionally keeps every chart the same total height —
 * without it, a chart whose panels have nothing to say sits flush against the
 * bottom of its box while one with labelled panels grows to fit them, and the
 * two read as different components rather than the same chart in two states.
 *
 * In rem, not px: the caption it holds grows with the reader's font-size
 * preference.
 */
const labelHeight = "1.125rem";

/**
 * The space above a panel's curve, which the depth ceiling and its label sit in.
 *
 * It is reserved by a spacer inside the panel rather than by padding on the box
 * around it, so that a panel's hover and focus styling covers the full height of
 * the chart. Held on the box, it left a strip along the top that was inside the
 * border but outside every panel, and so stayed unhighlighted while the panel
 * below it was hovered.
 *
 * In rem, like the label row: the depth label sits in it.
 */
const headroom = "1.125rem";

/**
 * The narrowest panel that carries both a label and its length, in rem.
 *
 * The caption it has to fit is sized in rem, so this is too. Held in px it
 * would be right at the default preference and wrong at every other, letting a
 * panel just over the bar draw a length too wide to sit inside it — the length
 * does not shrink, so it spills into the panel alongside.
 */
const lengthMinWidth = 7.5;

// The ceiling is read at a glance against the curve below it, so it is rounded
// hard rather than given the exact figure the depth column already carries.
function formatDepth(depth: number): string {
	if (depth < 1000) {
		return String(depth);
	}

	const [divisor, suffix] = depth < 1_000_000 ? [1000, "k"] : [1_000_000, "M"];

	return `${(depth / divisor).toFixed(1).replace(/\.0$/, "")}${suffix}`;
}

/** One panel of a coverage chart: the curve to draw, and its caption. */
export type CoveragePanel = {
	/** The coverage polyline to draw, or null/empty to draw nothing */
	align: Coordinate[] | null;

	/** A unique, stable key for the panel */
	key: string;

	/** The caption drawn below the panel; empty to reserve the space without text */
	label: string;

	/** The formatted length drawn after the label; empty to draw none */
	lengthLabel: string;

	/** The span of the reference this panel covers, which fixes its share of the chart */
	length: number;

	/**
	 * Detail revealed in a popover when the panel is activated.
	 *
	 * A panel that has one becomes a button covering both its curve and its
	 * caption; a panel without one is inert.
	 */
	detail?: ReactNode;
};

type Panel = CoveragePanel & {
	padLeft: number;
	padRight: number;
	width: number;
};

// Each panel takes the share of the chart its length is of the whole reference,
// so a position is the same number of nucleotides wide in every panel, and in
// every other chart laid out against the same reference — which is what lets an
// OTU's overview and each of its isolates' charts, and every isolate's charts
// against each other, be read against one another.
//
// The gutter is taken out of that share and handed to the outermost panels as
// padding, rather than held on the box: a panel's hover styling covers its own
// padding, where a gutter on the box leaves a strip inside the border that no
// panel covers and that stays unhighlighted while the panel beside it is
// hovered.
function layOutPanels(panels: CoveragePanel[], width: number): Panel[] {
	const total = panels.reduce((sum, panel) => sum + panel.length, 0);

	if (total === 0) {
		return [];
	}

	const available = Math.max(0, width - gap * (panels.length - 1) - gutter * 2);

	return panels.map((panel, index) => ({
		...panel,
		padLeft: index === 0 ? gutter : 0,
		padRight: index === panels.length - 1 ? gutter : 0,
		width: (available * panel.length) / total,
	}));
}

// A panel with no label has nothing else to identify it, so it keeps its length
// at any width rather than be left with a blank caption.
function showsLength(panel: Panel, rootFontSize: number): boolean {
	return (
		Boolean(panel.lengthLabel) &&
		(!panel.label || panel.width >= lengthMinWidth * rootFontSize)
	);
}

type PathoscopeCoverageChartProps = {
	/** The accessible description of the whole chart */
	description: string;

	/** The height of the plotting area */
	height: number;

	/** The greatest depth any panel may draw, so every panel's curve is comparable */
	maxDepth: number;

	/** The panels to draw, in the order they should appear */
	panels: CoveragePanel[];
};

/**
 * A coverage chart with one or more panels side by side, sharing one bordered
 * box, one depth domain, and one measured width — used for both an OTU's
 * merged overview and each of its isolates, so the two read as the same kind
 * of figure rather than two different ones.
 */
export default function PathoscopeCoverageChart({
	description,
	height,
	maxDepth,
	panels,
}: PathoscopeCoverageChartProps) {
	const [ref, { width }] = useElementSize<HTMLDivElement>();
	const rootFontSize = useRootFontSize();

	const laidOut = width > 0 ? layOutPanels(panels, width) : [];

	// A chart whose panels open popovers holds buttons, which an `img` would make
	// presentational. One that has none is a single graphic, and reads better to
	// assistive technology as one named object than as a group of unnamed ones.
	const interactive = panels.some((panel) => Boolean(panel.detail));

	function renderPanel(panel: Panel) {
		const d = panel.align
			? buildDepthPath(panel.align, panel.length, panel.width, maxDepth, height)
			: "";

		// The curve carries no text, so it is named by the chart around it rather
		// than exposed as an unlabelled graphic of its own.
		const body = (
			<>
				<div style={{ height: headroom }} />
				<svg
					aria-hidden="true"
					className="block"
					height={height}
					width={panel.width}
				>
					{/* Every panel draws the ceiling, but only the chart labels it: the
					    domain is shared, so the curves are what differ from panel to
					    panel and the line they are measured against does not.

					    Half a pixel down, so a one-pixel stroke lands inside the svg
					    rather than being clipped by its top edge. */}
					{maxDepth > 0 && (
						<line
							className="stroke-gray-500"
							shapeRendering="crispEdges"
							strokeDasharray="2 3"
							x1={0}
							x2={panel.width}
							y1={0.5}
							y2={0.5}
						/>
					)}
					{d ? <path className="fill-blue-500" d={d} /> : null}
				</svg>
				{/* The label gives way first: an ellipsis destroys a length outright
				    where a truncated label is still recognisable.

				    `gray-600`, not the `gray-500` other captions use: on `blue-100`
				    `gray-500` is 4.0:1 and fails AA. */}
				<div
					className="flex gap-1 items-baseline pt-0.5 text-gray-600 text-sm"
					style={{ height: labelHeight }}
				>
					<span className="min-w-0 text-left truncate">{panel.label}</span>
					{showsLength(panel, rootFontSize) && (
						<>
							{panel.label && (
								<span aria-hidden="true" className="shrink-0">
									·
								</span>
							)}
							<span className="shrink-0 tabular-nums">{panel.lengthLabel}</span>
						</>
					)}
				</div>
			</>
		);

		const padding = {
			paddingLeft: panel.padLeft,
			paddingRight: panel.padRight,
		};

		return (
			<div
				key={panel.key}
				style={{ width: panel.width + panel.padLeft + panel.padRight }}
			>
				{panel.detail ? (
					<Popover
						align="center"
						alignOffset={0}
						sideOffset={8}
						trigger={
							<button
								aria-label={`${panel.label} sequence details`}
								className="block w-full cursor-pointer border-0 bg-transparent py-0 text-left hover:bg-blue-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
								style={padding}
								type="button"
							>
								{body}
							</button>
						}
					>
						{panel.detail}
					</Popover>
				) : (
					<div style={padding}>{body}</div>
				)}
			</div>
		);
	}

	// The height is fixed rather than left to the panels, so the box does not
	// collapse in the frame before the container has been measured.
	const style = {
		gap,
		height: `calc(${height}px + ${headroom} + ${labelHeight})`,
	};

	// The label is drawn over the chart rather than inside a panel's svg, which
	// clips its own overflow — a narrow first panel would cut it off.
	//
	// It is hidden from assistive technology, and its figure folded into the
	// chart's name instead: a tooltip on a span is not reliably announced, and
	// making it a focusable trigger would put a button in the chart that does
	// nothing when pressed.
	const label = maxDepth > 0 && (
		<Tooltip tip="Maximum observed depth">
			<span
				aria-hidden="true"
				className="absolute flex gap-0.5 items-center left-1 top-0.5 text-gray-600 text-xs tabular-nums"
			>
				<Icon className="size-3.5" icon={Mountain} />
				{formatDepth(maxDepth)}
			</span>
		</Tooltip>
	);

	const name =
		maxDepth > 0
			? `${description}, drawn to a peak depth of ${maxDepth}`
			: description;

	// The border and padding sit on the outer element and the width is measured on
	// the inner one, because `useElementSize` reports `offsetWidth` — a border-box
	// figure. Measuring the bordered element would size the chart to two pixels
	// wider than the box it has to fit inside.
	//
	// The two roles are spelled out rather than chosen into one `role` expression
	// because `useAriaPropsSupportedByRole` can only check a literal, and an
	// unchecked `aria-label` is worth less than the duplication costs.
	return (
		<div className="bg-blue-100 border border-blue-200 relative rounded-sm">
			{label}
			{interactive ? (
				// biome-ignore lint/a11y/useSemanticElements: a fieldset groups form controls, not a set of related graphics
				<div
					aria-label={name}
					className="flex"
					ref={ref}
					role="group"
					style={style}
				>
					{laidOut.map(renderPanel)}
				</div>
			) : (
				<div
					aria-label={name}
					className="flex"
					ref={ref}
					role="img"
					style={style}
				>
					{laidOut.map(renderPanel)}
				</div>
			)}
		</div>
	);
}
