import { useActiveHit } from "@analyses/hooks";
import type { FormattedNuvsHit } from "@analyses/types";
import Badge from "@base/Badge";
import type { NuvsOrf as NuvsOrfType } from "@virtool/contracts";
import { sortBy } from "es-toolkit";
import type { ReactNode } from "react";
import NuvsBlast from "./NuvsBlast";
import NuvsOrf from "./NuvsOrf";
import NuvsSequence from "./NuvsSequence";
import NuvsValues from "./NuvsValues";

function NuvsFamilies({ families }: { families: string[] }) {
	return (
		<div className="flex border border-gray-300 rounded mt-2.5 mb-1 overflow-hidden">
			<div className="py-1 px-2.5 bg-gray-100 border-r border-gray-300">
				Families
			</div>
			<div className="py-1 px-2.5">
				{families.length ? families.join(", ") : "None"}
			</div>
		</div>
	);
}

function NuvsDetailContainer({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col flex-grow items-stretch">{children}</div>
	);
}

type NuVsDetailProps = {
	analysisId: number;
	filterORFs: boolean;
	/** A list of sorted and filtered Nuvs hits */

	matches: FormattedNuvsHit[];
	maxSequenceLength: number;
};

/**
 * The detailed view of a Nuvs sequence
 */
export default function NuvsDetail({
	analysisId,
	filterORFs,
	matches,
	maxSequenceLength,
}: NuVsDetailProps) {
	const hit = useActiveHit(matches);

	if (!hit) {
		return <NuvsDetailContainer>No Hits</NuvsDetailContainer>;
	}

	const { annotatedOrfCount, e, families, orfs, sequence, index } = hit;

	let filtered: NuvsOrfType[] = orfs;

	if (filterORFs) {
		filtered = orfs.filter((orf) => orf.hits.length);
	}

	filtered = sortBy(filtered, [(orf) => orf.hits.length]).reverse();

	const orfComponents = filtered.map((orf) => (
		<NuvsOrf
			key={`${orf.index}-${orf.frame}-${orf.pos.join("-")}`}
			{...orf}
			maxSequenceLength={maxSequenceLength}
		/>
	));

	return (
		<NuvsDetailContainer>
			<div className="mb-2.5 [&_span]:text-sm [&_span]:font-bold">
				<h3 className="flex items-center justify-between text-base font-bold m-0">
					Sequence {index}
					<Badge className="text-base py-2 px-3">{sequence.length} bp</Badge>
				</h3>
				<NuvsValues e={e} orfCount={annotatedOrfCount} />
				<NuvsFamilies families={families} />
			</div>
			<div className="border border-gray-300 mb-4 [&>div:nth-child(even)]:bg-gray-100">
				<NuvsSequence
					key="sequence"
					maxSequenceLength={maxSequenceLength}
					sequence={sequence}
				/>
				{orfComponents}
			</div>
			<NuvsBlast hit={hit} analysisId={analysisId} />
		</NuvsDetailContainer>
	);
}
