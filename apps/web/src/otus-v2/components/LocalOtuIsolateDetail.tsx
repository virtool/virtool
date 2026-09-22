import { BoxGroup, BoxGroupSection } from "@base/Box";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import Link from "@base/Link";
import SectionHeader from "@base/SectionHeader";
import DeleteLocalOtuIsolate from "@otus-v2/components/DeleteLocalOtuIsolate";
import EditLocalOtuIsolate from "@otus-v2/components/EditLocalOtuIsolate";
import EditLocalOtuSequence from "@otus-v2/components/EditLocalOtuSequence";
import PromoteLocalOtuIsolate from "@otus-v2/components/PromoteLocalOtuIsolate";
import { formatV2IsolateName } from "@otus-v2/isolateName";
import {
	localOtuV2SequenceQueryOptions,
	useSuspenseLocalOtuV2,
	useSuspenseLocalOtuV2Isolate,
} from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import type { LocalOtuV2Overview } from "@virtool/contracts";
import { useState } from "react";

const routeApi = getRouteApi(
	"/_authenticated/refs/alpha/$referenceId/otus/$otuId/isolates/$isolateId",
);

/** Displays one local v2 isolate and loads sequence bodies on expansion. */
export default function LocalOtuIsolateDetail() {
	const { referenceId, otuId, isolateId } = routeApi.useParams();
	const { data: isolate } = useSuspenseLocalOtuV2Isolate(
		referenceId,
		otuId,
		isolateId,
	);
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);
	const canDelete =
		useCanModifyReferenceV2Otus(referenceId) && otu.isolateCount > 1;
	const navigate = routeApi.useNavigate();

	const name = formatV2IsolateName(isolate.name);

	return (
		<>
			<p className="mb-4">
				<Link
					to="/refs/alpha/$referenceId/otus/$otuId/isolates"
					params={{ referenceId, otuId }}
				>
					← Isolates
				</Link>
			</p>
			<SectionHeader className="flex items-center justify-between gap-3">
				<h2>{name}</h2>
				<div className="flex items-center gap-2">
					<PromoteLocalOtuIsolate
						referenceId={referenceId}
						otuId={otuId}
						isolateId={isolateId}
						version={otu.version}
					/>
					<EditLocalOtuIsolate
						referenceId={referenceId}
						otuId={otuId}
						version={otu.version}
						isolate={isolate}
					/>
					{canDelete && (
						<DeleteLocalOtuIsolate
							referenceId={referenceId}
							otuId={otuId}
							version={otu.version}
							isolate={isolate}
							onDeleted={() =>
								navigate({
									to: "/refs/alpha/$referenceId/otus/$otuId/isolates",
									params: { referenceId, otuId },
								})
							}
						/>
					)}
				</div>
			</SectionHeader>
			<section>
				<SectionHeader>
					<h2>Sequences</h2>
				</SectionHeader>
				<BoxGroup>
					{isolate.sequences.map((sequence) => (
						<LazySequence
							key={sequence.id}
							referenceId={referenceId}
							otuId={otuId}
							isolateId={isolateId}
							sequenceId={sequence.id}
							definition={sequence.definition}
							version={otu.version}
							plan={otu.plan}
						/>
					))}
				</BoxGroup>
			</section>
		</>
	);
}

function LazySequence({
	referenceId,
	otuId,
	isolateId,
	sequenceId,
	definition,
	version,
	plan,
}: {
	referenceId: string;
	otuId: string;
	isolateId: string;
	sequenceId: string;
	definition: string;
	version: number;
	plan: LocalOtuV2Overview["plan"];
}) {
	const [open, setOpen] = useState(false);
	const query = useQuery({
		...localOtuV2SequenceQueryOptions(
			referenceId,
			otuId,
			isolateId,
			sequenceId,
		),
		enabled: open,
	});

	return (
		<BoxGroupSection className="p-0">
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="px-6 py-3">
					{definition}
				</CollapsibleTrigger>
				<CollapsibleContent className="px-6 pb-3">
					{query.isPending && <p>Loading sequence…</p>}
					{query.isError && <p>Unable to load sequence.</p>}
					{query.data && (
						<>
							<p className="mb-2 text-slate-600 text-sm">
								{query.data.source === "genbank"
									? `GenBank · ${query.data.accessionVersion}`
									: "Entered manually"}
							</p>
							<p className="break-all font-mono">{query.data.sequence}</p>
							<EditLocalOtuSequence
								referenceId={referenceId}
								otuId={otuId}
								isolateId={isolateId}
								version={version}
								plan={plan}
								sequence={query.data}
							/>
						</>
					)}
				</CollapsibleContent>
			</Collapsible>
		</BoxGroupSection>
	);
}
