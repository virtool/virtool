import type { FormattedPathoscopeAnalysis } from "@analyses/types";
import { cn } from "@app/cn";
import { toThousand } from "@app/format";
import Box from "@base/Box";
import Label from "@base/Label";
import Link from "@base/Link";
import type { SubtractionNested } from "@virtool/contracts";
import type { ReactNode } from "react";
import { Bars, type BarsItem } from "../Viewer/Bars";
import { type BarColor, bgColorClasses } from "../Viewer/colors";

const MINUS = "−";

const percentFormatter = new Intl.NumberFormat("en-US", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function formatPercent(count: number, total: number): string | undefined {
	return total > 0 ? percentFormatter.format(count / total) : undefined;
}

type MappingRowProps = {
	count: number;

	/** The bar segment this row labels. Rows that carry a sum have none. */
	marker?: BarColor;

	/** Draws the row as an amount taken away from the one above it. */
	negative?: boolean;

	percent?: string;

	title: ReactNode;
};

function MappingRow({
	count,
	marker,
	negative,
	percent,
	title,
}: MappingRowProps) {
	return (
		<tr>
			<th className="font-normal text-gray-700 text-left py-0.5" scope="row">
				<span className={cn("flex items-center gap-2.5", { "pl-5": !marker })}>
					{marker && (
						<span
							aria-hidden="true"
							className={cn(
								"h-2.5 w-2.5 rounded-full shrink-0",
								bgColorClasses[marker],
							)}
						/>
					)}
					<span>{title}</span>
				</span>
			</th>
			<td className="font-medium pl-8 text-gray-700 text-right tabular-nums whitespace-nowrap">
				{negative && MINUS}
				{toThousand(count)}
			</td>
			<td className="pl-6 text-right tabular-nums whitespace-nowrap text-gray-500">
				{percent && (
					<>
						{negative && MINUS}
						{percent}
					</>
				)}
			</td>
		</tr>
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
	const { readCount } = results;

	const subtracted = subtractions.length > 0 ? results.subtractedCount : 0;

	const mappedCount = readCount + subtracted;
	const unmappedCount = Math.max(0, totalReads - mappedCount);

	const items: BarsItem[] = [{ color: "blue", count: readCount }];

	if (subtracted > 0) {
		items.push({ color: "orange", count: subtracted });
	}

	const mappedPercent = formatPercent(mappedCount, totalReads);
	const referenceTitle = (
		<>
			Mapped to{" "}
			<span className="inline-flex items-center gap-1">
				<Link to="/refs/$refId" params={{ refId: String(reference.id) }}>
					{reference.name}
				</Link>
				<Label>{index.version}</Label>
			</span>
		</>
	);

	return (
		<Box className="mb-8">
			<h3 className="text-lg font-semibold mb-2.5 text-gray-900">
				{mappedPercent
					? `${mappedPercent} of reads mapped to the reference`
					: "Mapped to the reference"}
			</h3>

			<Bars
				empty={unmappedCount}
				items={items}
				label={`${toThousand(mappedCount)} of ${toThousand(totalReads)} reads mapped to the reference, ${toThousand(subtracted)} of which were subtracted`}
			/>

			<table className="mt-4">
				<caption className="sr-only">
					How the sample's reads were accounted for
				</caption>
				<thead className="sr-only">
					<tr>
						<th scope="col">Category</th>
						<th scope="col">Reads</th>
						<th scope="col">Share of total reads</th>
					</tr>
				</thead>
				<tbody>
					{totalReads > 0 && (
						<MappingRow count={totalReads} title="Total reads" />
					)}

					{subtractions.length > 0 ? (
						<>
							<MappingRow
								count={mappedCount}
								percent={mappedPercent}
								title={referenceTitle}
							/>
							<MappingRow
								count={subtracted}
								marker="orange"
								negative
								percent={formatPercent(subtracted, totalReads)}
								title={
									<>
										Subtracted, mapped better to{" "}
										<AnalysisMappingSubtractionTitle
											subtractions={subtractions}
										/>
									</>
								}
							/>
						</>
					) : (
						<MappingRow
							count={readCount}
							marker="blue"
							percent={mappedPercent}
							title={referenceTitle}
						/>
					)}
				</tbody>
				{subtractions.length > 0 && (
					<tfoot className="border-t border-gray-300">
						<MappingRow
							count={readCount}
							marker="blue"
							percent={formatPercent(readCount, totalReads)}
							title="Analysed"
						/>
					</tfoot>
				)}
			</table>
		</Box>
	);
}
