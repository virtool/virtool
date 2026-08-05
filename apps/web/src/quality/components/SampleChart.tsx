import { useEffect, useRef } from "react";

type QualityChartProps<T> = {
	/** A callback function to create the sample quality chart */
	createChart: (current: HTMLDivElement, data: T, width: number) => void;

	/** The data to be used in the chart */
	data: T;

	/** The width of the chart */
	width: number;
};

/**
 * Creates and displays charts for sample quality
 */
export function SampleChart<T>({
	createChart,
	data,
	width,
}: QualityChartProps<T>) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current) {
			createChart(ref.current, data, width);
		}
	}, [createChart, data, width]);

	return <div className="quality-chart min-h-96" ref={ref} />;
}
