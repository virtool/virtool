import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import CreateLocalOtuIsolateDialog from "@otus-v2/components/CreateLocalOtuIsolateDialog";
import { useSuspenseLocalOtuV2 } from "@otus-v2/queries";
import { useState } from "react";

/** The Isolates tab of the local v2 OTU detail view. */
export default function LocalOtuIsolates({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);
	const [open, setOpen] = useState(false);

	return (
		<>
			<div className="mb-4 flex justify-end">
				<Button color="blue" onClick={() => setOpen(true)}>
					Create isolate
				</Button>
			</div>
			<CreateLocalOtuIsolateDialog
				open={open}
				setOpen={setOpen}
				referenceId={referenceId}
				otuId={otuId}
				version={otu.version}
			/>
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
