import { useFuse } from "@app/fuse";
import { BoxGroup, BoxGroupTable } from "@base/Box";
import Button from "@base/Button";
import { InputSearch } from "@base/Input";
import Link from "@base/Link";
import RelativeTime from "@base/RelativeTime";
import { TableActionsCell, TableActionsHead, TableHead } from "@base/Table";
import CreateLocalOtuIsolateDialog from "@otus-v2/components/CreateLocalOtuIsolateDialog";
import DeleteLocalOtuIsolate from "@otus-v2/components/DeleteLocalOtuIsolate";
import { formatV2IsolateName } from "@otus-v2/isolateName";
import {
	useSuspenseLocalOtuV2,
	useSuspenseLocalOtuV2Isolates,
} from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import type { LocalOtuV2IsolateSummary } from "@virtool/contracts";
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
	const canModifyOtus = useCanModifyReferenceV2Otus(referenceId);
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
				{canModifyOtus && (
					<Button color="blue" onClick={() => setOpen(true)}>
						Create
					</Button>
				)}
			</div>
			{canModifyOtus && (
				<CreateLocalOtuIsolateDialog
					open={open}
					setOpen={setOpen}
					referenceId={referenceId}
					otuId={otuId}
					version={otu.version}
				/>
			)}
			<BoxGroup>
				<BoxGroupTable variant="data">
					<caption className="sr-only">Isolates</caption>
					<TableHead>
						<th scope="col">Name</th>
						<th scope="col">Created</th>
						<TableActionsHead />
					</TableHead>
					<tbody>
						{results.map((isolate) => (
							<LocalOtuIsolateRow
								isolate={isolate}
								key={isolate.id}
								referenceId={referenceId}
								otuId={otuId}
								version={otu.version}
								canDelete={canModifyOtus && otu.isolateCount > 1}
							/>
						))}
					</tbody>
				</BoxGroupTable>
			</BoxGroup>
		</>
	);
}

type LocalOtuIsolateRowProps = {
	isolate: LocalOtuV2IsolateSummary;
	otuId: string;
	referenceId: string;
	version: number;
	canDelete: boolean;
};

function LocalOtuIsolateRow({
	isolate,
	otuId,
	referenceId,
	version,
	canDelete,
}: LocalOtuIsolateRowProps) {
	const name = formatV2IsolateName(isolate.name);

	return (
		<tr>
			<td className="font-medium">
				<Link
					to="/refs/alpha/$referenceId/otus/$otuId/isolates/$isolateId"
					params={{ referenceId, otuId, isolateId: isolate.id }}
				>
					{name}
				</Link>
			</td>
			<td className="whitespace-nowrap text-gray-600 text-sm">
				<RelativeTime time={isolate.createdAt} />
			</td>
			<TableActionsCell>
				{canDelete && (
					<DeleteLocalOtuIsolate
						referenceId={referenceId}
						otuId={otuId}
						version={version}
						isolate={isolate}
					/>
				)}
			</TableActionsCell>
		</tr>
	);
}
