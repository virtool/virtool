import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { toThousand } from "@app/format";
import Box from "@base/Box";
import Label from "@base/Label";
import Link from "@base/Link";
import type {
	AnalysisIndexNested,
	AnalysisReferenceNested,
	SubtractionNested,
} from "@virtool/contracts";
import { Bars, type BarsItem } from "../Viewer/Bars";

const percentFormatter = new Intl.NumberFormat("en-US", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

type AnalysisMappingReferenceTitleProps = {
	index: AnalysisIndexNested;
	reference: AnalysisReferenceNested;
};

export function AnalysisMappingReferenceTitle({
	index,
	reference,
}: AnalysisMappingReferenceTitleProps) {
	return (
		<div className="flex items-center [&_a]:mr-1">
			<Link to="/refs/$refId" params={{ refId: String(reference.id) }}>
				{reference.name}
			</Link>
			<Label>{index.version}</Label>
		</div>
	);
}

type AnalysisMappingSubtractionTitleProps = {
	subtractions: SubtractionNested[];
};

export function AnalysisMappingSubtractionTitle({
	subtractions,
}: AnalysisMappingSubtractionTitleProps) {
	return subtractions.map((subtraction, index) => (
		<span key={subtraction.id}>
			<Link
				to="/subtractions/$subtractionId"
				params={{ subtractionId: String(subtraction.id) }}
			>
				{subtraction.name}
			</Link>
			{index !== subtractions.length - 1 ? ", " : ""}
		</span>
	));
}

type AnalysisMappingProps = {
	totalReads: number;
	detail: FormattedPathoscopeAnalysis;
};

export function AnalysisMapping({ totalReads, detail }: AnalysisMappingProps) {
	const { index, reference, subtractions, results } = detail;
	const { readCount, subtractedCount } = results;

	const totalMapped = readCount + subtractedCount;
	const sumPercent = readCount / totalReads;

	const legend: BarsItem[] = [
		{
			color: "blue",
			count: readCount,
			title: (
				<AnalysisMappingReferenceTitle index={index} reference={reference} />
			),
		},
	];

	if (subtractions.length > 0) {
		legend.push({
			color: "orange",
			count: subtractedCount,
			title: <AnalysisMappingSubtractionTitle subtractions={subtractions} />,
		});
	}

	return (
		<Box className="mb-8">
			<h3 className="flex items-end justify-between text-2xl font-normal my-4 mb-2.5">
				{percentFormatter.format(sumPercent)} mapped
				<small className="text-gray-500 text-base font-semibold">
					{toThousand(readCount)} of {toThousand(totalReads)} reads
				</small>
			</h3>

			<Bars empty={totalReads - totalMapped} items={legend} />
		</Box>
	);
}
