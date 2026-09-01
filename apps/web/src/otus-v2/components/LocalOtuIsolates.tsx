import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import Link from "@base/Link";
import CreateLocalOtuIsolateDialog from "@otus-v2/components/CreateLocalOtuIsolateDialog";
import {
	useSuspenseLocalOtuV2,
	useSuspenseLocalOtuV2Isolates,
} from "@otus-v2/queries";
import { useState } from "react";

/** The Isolates tab of the local v2 OTU detail view. */
export default function LocalOtuIsolates({
	referenceId,
	otuId,
}: {
	referenceId: string;
	otuId: string;
}) {
	const { data: isolates } = useSuspenseLocalOtuV2Isolates(referenceId, otuId);
	const { data: otu } = useSuspenseLocalOtuV2(referenceId, otuId);
	const [open, setOpen] = useState(false);

	return (
		<>
			<div className="mb-4 flex justify-end">
				<Button color="blue" onClick={() => setOpen(true)}>
					Create
				</Button>
			</div>
			<CreateLocalOtuIsolateDialog
				open={open}
				setOpen={setOpen}
				referenceId={referenceId}
				otuId={otuId}
				version={otu.version}
			/>
			<BoxGroup as="ul">
				{isolates.map((isolate) => (
					<BoxGroupSection as="li" key={isolate.id}>
						<Link
							className="font-medium text-lg"
							to="/refs/beta/$referenceId/otus/$otuId/isolates/$isolateId"
							params={{ referenceId, otuId, isolateId: isolate.id }}
						>
							{isolate.name
								? `${isolate.name.type} ${isolate.name.value}`
								: "Unnamed isolate"}
						</Link>
					</BoxGroupSection>
				))}
			</BoxGroup>
		</>
	);
}
