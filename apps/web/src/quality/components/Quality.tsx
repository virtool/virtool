import { useElementSize } from "@app/hooks";
import SectionHeader from "@base/SectionHeader";
import type { RefObject } from "react";
import { drawBasesChart } from "./Bases";
import { drawNucleotidesChart } from "./Nucleotides";
import { SampleChart } from "./SampleChart";
import { drawSequencesChart } from "./Sequences";

type QualityProps = {
	bases: number[][];
	composition: number[][];
	sequences: number[];
};

export function Quality({ bases, composition, sequences }: QualityProps) {
	const [ref, { width }] = useElementSize();

	return (
		<div ref={ref as RefObject<HTMLDivElement>}>
			{width && (
				<>
					<section>
						<SectionHeader>
							<h2>Quality Distribution at Read Positions</h2>
						</SectionHeader>
						<SampleChart
							createChart={drawBasesChart}
							data={bases}
							width={width}
						/>
					</section>

					<section>
						<SectionHeader>
							<h2>Nucleotide Composition at Read Positions</h2>
						</SectionHeader>
						<SampleChart
							createChart={drawNucleotidesChart}
							data={composition}
							width={width}
						/>
					</section>

					<section>
						<SectionHeader>
							<h2>Read-wise Quality Occurrence</h2>
						</SectionHeader>
						<SampleChart
							createChart={drawSequencesChart}
							data={sequences}
							width={width}
						/>
					</section>
				</>
			)}
		</div>
	);
}
