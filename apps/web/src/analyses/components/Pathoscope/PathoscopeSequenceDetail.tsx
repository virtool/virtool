import { toScientificNotation, toThousand } from "@app/format";
import ExternalLink from "@base/ExternalLink";
import Icon from "@base/Icon";
import type { PathoscopeSequence } from "@virtool/contracts";
import { SquareArrowOutUpRight } from "lucide-react";
import type { ReactNode } from "react";

type DetailRowProps = {
	label: string;
	value: ReactNode;
};

function DetailRow({ label, value }: DetailRowProps) {
	return (
		<tr className="border-b border-gray-200 last:border-b-0">
			<th
				className="font-medium px-3 py-1.5 text-gray-500 text-left"
				scope="row"
			>
				{label}
			</th>
			<td className="px-3 py-1.5 tabular-nums text-gray-900 text-right">
				{value}
			</td>
		</tr>
	);
}

type PathoscopeSequenceDetailProps = {
	/** The reference sequence the panel draws */
	sequence: PathoscopeSequence;
};

/**
 * The figures behind one panel of an isolate's coverage chart.
 *
 * A table rather than a run of prose: the accession and definition identify the
 * sequence, and the rows beneath carry the same four figures for every one of
 * them, so they can be read down a column rather than picked out of a sentence.
 */
export default function PathoscopeSequenceDetail({
	sequence,
}: PathoscopeSequenceDetailProps) {
	return (
		<div className="py-2">
			<table className="w-full border-collapse text-sm">
				<caption className="px-3 pb-2 text-left">
					{/* Inline rather than block, so the hit area is the accession itself
					    and not the whole width of the popover. */}
					<ExternalLink
						className="font-medium gap-1 inline-flex items-center"
						href={`https://www.ncbi.nlm.nih.gov/nuccore/${sequence.accession}`}
					>
						{sequence.accession}
						<Icon className="size-3.5" icon={SquareArrowOutUpRight} />
					</ExternalLink>
					<span className="block text-gray-500">{sequence.definition}</span>
				</caption>
				<tbody>
					<DetailRow
						label="Length"
						value={`${toThousand(sequence.length)} nt`}
					/>
					<DetailRow label="Reads" value={toThousand(sequence.reads)} />
					<DetailRow label="Weight" value={toScientificNotation(sequence.pi)} />
					<DetailRow label="Coverage" value={sequence.coverage.toFixed(3)} />
				</tbody>
			</table>
		</div>
	);
}
