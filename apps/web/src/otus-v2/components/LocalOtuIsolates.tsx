import { useFuse } from "@app/fuse";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import { InputSearch } from "@base/Input";
import Link from "@base/Link";
import CreateLocalOtuIsolateDialog from "@otus-v2/components/CreateLocalOtuIsolateDialog";
import {
	useSuspenseLocalOtuV2,
	useSuspenseLocalOtuV2Isolates,
} from "@otus-v2/queries";
import { useState } from "react";

const ISOLATE_SEARCH_KEYS = ["name.value"];

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
	const [results, term, setTerm] = useFuse(isolates, ISOLATE_SEARCH_KEYS);

	return (
		<>
			<div className="mb-4 flex gap-2">
				<InputSearch
					aria-label="Search isolates"
					placeholder="Search isolates"
					value={term}
					onChange={(event) => setTerm(event.target.value)}
				/>
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
				{results.map((isolate) => (
					<BoxGroupSection as="li" key={isolate.id}>
						<Link
							className="font-medium text-lg"
							to="/refs/alpha/$referenceId/otus/$otuId/isolates/$isolateId"
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
