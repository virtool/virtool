import { formatIsolateName } from "@app/utils";
import Alert from "@base/Alert";
import { IconButton } from "@base/Icon";
import { useCurrentOtuContext } from "@otus/components/CurrentOtuContext";
import { useSetIsolateAsDefault } from "@otus/queries";
import { DownloadLink } from "@references/components/Detail/DownloadLink";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import CreateSequenceButton from "@sequences/components/CreateSequenceButton";
import Sequences from "@sequences/components/Sequences";
import { getRouteApi, Navigate } from "@tanstack/react-router";
import { Pencil, Star, Trash } from "lucide-react";
import { useState } from "react";
import DeleteIsolate from "./DeleteIsolate";
import EditIsolate from "./EditIsolate";

const routeApi = getRouteApi(
	"/_authenticated/refs/$refId/otus/$otuId/isolates/$isolateId",
);

/**
 * Display and edit information for the selected Isolate
 */
export default function IsolateDetail() {
	const { refId, otuId, isolateId } = routeApi.useParams();
	const { otu, reference } = useCurrentOtuContext();
	const [openEdit, setOpenEdit] = useState(false);
	const [openDelete, setOpenDelete] = useState(false);
	const [openCreateSequence, setOpenCreateSequence] = useState(false);
	const mutation = useSetIsolateAsDefault();
	const { hasPermission: canModify } = useCheckReferenceRight(
		reference.id,
		"modifyOtu",
	);
	const archived = useReferenceIsArchived(reference.id);
	const canModifyIsolates = canModify && !archived;

	const activeIsolate = otu.isolates.find(
		(isolate) => isolate.id === isolateId,
	);

	if (!activeIsolate) {
		return (
			<Navigate
				to="/refs/$refId/otus/$otuId/isolates"
				params={{ refId, otuId }}
				replace
			/>
		);
	}

	return (
		<div className="flex-1 min-w-0">
			<EditIsolate
				key={activeIsolate.id}
				otuId={otuId}
				isolateId={activeIsolate.id}
				sourceType={activeIsolate.sourceType}
				sourceName={activeIsolate.sourceName}
				allowedSourceTypes={reference.sourceTypes}
				restrictSourceTypes={reference.restrictSourceTypes}
				show={openEdit}
				onHide={() => setOpenEdit(false)}
			/>

			<DeleteIsolate
				id={activeIsolate.id}
				name={formatIsolateName(activeIsolate)}
				onHide={() => setOpenDelete(false)}
				otuId={otuId}
				show={openDelete}
			/>

			<div className="flex items-center justify-between gap-3 mb-4">
				<h2 className="text-xl font-semibold truncate min-w-0">
					{formatIsolateName(activeIsolate)}
				</h2>
				<div className="flex items-center gap-1 shrink-0">
					{canModifyIsolates && (
						<>
							<IconButton
								IconComponent={Pencil}
								color="gray"
								tip="edit name"
								onClick={() => setOpenEdit(true)}
							/>
							{!activeIsolate.default && (
								<IconButton
									IconComponent={Star}
									color="green"
									tip="set as default"
									onClick={() =>
										mutation.mutate({
											otuId,
											isolateId: activeIsolate.id,
										})
									}
								/>
							)}
							<IconButton
								IconComponent={Trash}
								color="red"
								tip="delete"
								onClick={() => setOpenDelete(true)}
							/>
						</>
					)}
					<DownloadLink
						href={`/otus/${otuId}/isolates/${activeIsolate.id}/fasta`}
					>
						FASTA
					</DownloadLink>
					<CreateSequenceButton
						onCreate={() => setOpenCreateSequence(true)}
						referenceId={reference.id}
					/>
				</div>
			</div>

			{activeIsolate.default && (
				<Alert color="green" icon={Star} className="items-start">
					<div>
						<p className="m-0 font-semibold">Default isolate</p>
						<p className="m-0 font-normal">
							Virtool uses this isolate to represent the OTU wherever a single
							isolate is needed. Each OTU has exactly one default isolate.
						</p>
					</div>
				</Alert>
			)}

			<Sequences
				otuId={otuId}
				activeIsolate={activeIsolate}
				openCreate={openCreateSequence}
				setOpenCreate={setOpenCreateSequence}
			/>
		</div>
	);
}
