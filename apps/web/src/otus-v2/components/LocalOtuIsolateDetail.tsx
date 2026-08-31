import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import Link from "@base/Link";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";
import { getRouteApi, Navigate } from "@tanstack/react-router";

const routeApi = getRouteApi(
	"/_authenticated/refs/beta/$referenceId/otus/$otuId/isolates/$isolateId",
);

/** Displays one local v2 isolate and its sequences. */
export default function LocalOtuIsolateDetail() {
	const { referenceId, otuId, isolateId } = routeApi.useParams();
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);
	const isolate = otu.isolates.find((candidate) => candidate.id === isolateId);

	if (!isolate) {
		return (
			<Navigate
				to="/refs/beta/$referenceId/otus/$otuId/isolates"
				params={{ referenceId, otuId }}
				replace
			/>
		);
	}

	const name = isolate.name
		? `${isolate.name.type} ${isolate.name.value}`
		: "Unnamed isolate";

	return (
		<>
			<p className="mb-4">
				<Link
					to="/refs/beta/$referenceId/otus/$otuId/isolates"
					params={{ referenceId, otuId }}
				>
					← Isolates
				</Link>
			</p>
			<h2 className="mb-4 text-xl font-semibold">{name}</h2>
			<BoxGroup>
				<BoxGroupHeader>Sequences</BoxGroupHeader>
				{isolate.sequences.map((sequence) => (
					<BoxGroupSection key={sequence.id}>
						<div className="font-semibold">{sequence.definition}</div>
						<div className="break-all font-mono text-sm">
							{sequence.sequence}
						</div>
					</BoxGroupSection>
				))}
			</BoxGroup>
		</>
	);
}
