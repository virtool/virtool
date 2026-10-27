import { byteSize, pluralize } from "@app/format";
import { useElementSize } from "@app/hooks";
import type { CacheUsageSnapshot } from "@virtool/contracts";
import { line, scaleLinear, scaleUtc, utcFormat } from "d3";

const HEIGHT = 220;
const MARGIN = { bottom: 28, left: 52, right: 12, top: 12 };

type CacheUsageChartProps = {
	budget: number;
	snapshots: CacheUsageSnapshot[];
};

/** A rolling chart of hourly workflow-cache usage against the storage budget. */
export default function CacheUsageChart({
	budget,
	snapshots,
}: CacheUsageChartProps) {
	const [ref, { width }] = useElementSize<HTMLDivElement>();
	const latest = snapshots.at(-1);

	if (!latest) {
		return (
			<div className="flex min-h-56 items-center justify-center text-center text-gray-500">
				Usage history will appear after the next hourly cache task.
			</div>
		);
	}

	const firstTime = snapshots[0]?.recordedAt.getTime() ?? 0;
	const lastTime = latest.recordedAt.getTime();
	const xDomain =
		firstTime === lastTime
			? [
					new Date(firstTime - 30 * 60 * 1000),
					new Date(lastTime + 30 * 60 * 1000),
				]
			: [new Date(firstTime), new Date(lastTime)];
	const maxSize = Math.max(
		budget,
		...snapshots.map(({ totalSize }) => totalSize),
	);
	const chartWidth = Math.max(width, MARGIN.left + MARGIN.right);
	const x = scaleUtc(xDomain, [MARGIN.left, chartWidth - MARGIN.right]);
	const y = scaleLinear(
		[0, maxSize],
		[HEIGHT - MARGIN.bottom, MARGIN.top],
	).nice();
	const usageLine = line<CacheUsageSnapshot>()
		.x(({ recordedAt }) => x(recordedAt))
		.y(({ totalSize }) => y(totalSize));
	const xTicks = x.ticks(4);
	const yTicks = y.ticks(4);
	const formatDate = utcFormat("%b %-d");

	return (
		<figure aria-labelledby="cache-usage-title">
			<figcaption className="mb-3 flex items-baseline justify-between gap-3">
				<h4 className="font-medium" id="cache-usage-title">
					Usage over 30 days
				</h4>
				<span className="text-gray-600 text-sm tabular-nums">
					{byteSize(latest.totalSize, true)} ·{" "}
					{pluralize(latest.cacheCount, "cache")}
				</span>
			</figcaption>
			<div className="min-h-56 w-full" ref={ref}>
				{width > 0 && (
					<svg
						aria-label={`Workflow cache usage. Latest usage is ${byteSize(latest.totalSize, true)} across ${pluralize(latest.cacheCount, "cache")}. The budget is ${byteSize(budget, true)}.`}
						className="block overflow-visible"
						height={HEIGHT}
						role="img"
						width={chartWidth}
					>
						{xTicks.map((tick) => (
							<g key={tick.getTime()} transform={`translate(${x(tick)},0)`}>
								<line
									className="stroke-gray-200"
									y1={MARGIN.top}
									y2={HEIGHT - MARGIN.bottom}
								/>
								<text
									className="fill-gray-500 text-xs"
									textAnchor="middle"
									y={HEIGHT - 8}
								>
									{formatDate(tick)}
								</text>
							</g>
						))}
						{yTicks.map((tick) => (
							<g key={tick} transform={`translate(0,${y(tick)})`}>
								<line
									className="stroke-gray-200"
									x1={MARGIN.left}
									x2={chartWidth - MARGIN.right}
								/>
								<text
									className="fill-gray-500 text-xs"
									textAnchor="end"
									x={MARGIN.left - 7}
									y={4}
								>
									{byteSize(tick)}
								</text>
							</g>
						))}
						<line
							className="stroke-orange-500"
							strokeDasharray="4 3"
							x1={MARGIN.left}
							x2={chartWidth - MARGIN.right}
							y1={y(budget)}
							y2={y(budget)}
						/>
						<path
							className="fill-none stroke-blue-500"
							d={usageLine(snapshots) ?? undefined}
							strokeWidth={2}
						/>
						<circle
							className="fill-blue-500"
							cx={x(latest.recordedAt)}
							cy={y(latest.totalSize)}
							r={3}
						/>
					</svg>
				)}
			</div>
			<div className="mt-2 flex justify-end text-gray-500 text-xs">
				<span className="flex items-center gap-1.5">
					<span className="inline-block w-5 border-orange-500 border-t border-dashed" />
					Budget
				</span>
			</div>
		</figure>
	);
}
