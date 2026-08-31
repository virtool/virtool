import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";

/** The Isolates tab of the local v2 OTU detail view. */
export default function LocalOtuIsolates({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);

	return (
		<>
			{otu.isolates.map((isolate) => (
				<BoxGroup key={isolate.id}>
					<BoxGroupHeader>
						{isolate.name
							? `${isolate.name.type} ${isolate.name.value}`
							: "Unnamed isolate"}
					</BoxGroupHeader>
					{isolate.sequences.map((sequence) => (
						<BoxGroupSection key={sequence.id}>
							<div className="font-semibold">{sequence.definition}</div>
							<div className="break-all font-mono text-sm">
								{sequence.sequence}
							</div>
						</BoxGroupSection>
					))}
				</BoxGroup>
			))}
		</>
	);
}
