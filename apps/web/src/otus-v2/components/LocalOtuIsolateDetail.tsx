import { BoxGroup, BoxGroupSection } from "@base/Box";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import Link from "@base/Link";
import SectionHeader from "@base/SectionHeader";
import {
	localOtuV2SequenceQueryOptions,
	useSuspenseLocalOtuV2Isolate,
} from "@otus-v2/queries";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
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

	const name = isolate.name
		? `${isolate.name.type} ${isolate.name.value}`
		: "Unnamed isolate";

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
			<SectionHeader>
				<h2>{name}</h2>
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
}: {
	referenceId: string;
	otuId: string;
	isolateId: string;
	sequenceId: string;
	definition: string;
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
						<p className="break-all font-mono">{query.data.sequence}</p>
					)}
				</CollapsibleContent>
			</Collapsible>
		</BoxGroupSection>
	);
}
