import Badge from "@base/Badge";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import { useCurrentOtuContext } from "@otus/components/CurrentOtuContext";
import sortSequencesBySegment from "@otus/utils";
import { useReferenceIsArchived } from "@references/hooks";
import type { OtuIsolate, OtuSequence } from "@virtool/contracts";
import { Dna } from "lucide-react";
import { useState } from "react";
import CreateSequence from "./CreateSequence";
import DeleteSequence from "./DeleteSequence";
import Sequence from "./Sequence";
import SequenceEdit from "./SequenceEdit";
import {
	SEQUENCE_ACCESSION_COLUMN,
	SEQUENCE_CHEVRON_COLUMN,
	SEQUENCE_DEFINITION_COLUMN,
	SEQUENCE_SEGMENT_COLUMN,
} from "./SequenceValues";

/**
 * Column headings for the sequence list, aligned to each row's cells.
 */
function SequenceListHeader() {
	return (
		<BoxGroupSection className="flex items-center bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
			<span aria-hidden className={SEQUENCE_CHEVRON_COLUMN} />
			<span className={SEQUENCE_ACCESSION_COLUMN}>Accession</span>
			<span className={SEQUENCE_SEGMENT_COLUMN}>Segment</span>
			<span className={SEQUENCE_DEFINITION_COLUMN}>Definition</span>
		</BoxGroupSection>
	);
}

type IsolateSequencesProps = {
	/** The Isolate that is currently selected */
	activeIsolate: OtuIsolate;
	otuId: string;
	/** Whether the create sequence dialog is open */
	openCreate: boolean;
	/** Called to change whether the create sequence dialog is open */
	setOpenCreate: (open: boolean) => void;
};

/**
 * Display and manage a list sequences for a specific isolate
 */
export default function Sequences({
	activeIsolate,
	otuId,
	openCreate,
	setOpenCreate,
}: IsolateSequencesProps) {
	const { otu, reference } = useCurrentOtuContext();
	const archived = useReferenceIsArchived(reference.id);
	const [sequenceToEdit, setSequenceToEdit] = useState<
		OtuSequence | undefined
	>();
	const [sequenceToDelete, setSequenceToDelete] = useState<
		OtuSequence | undefined
	>();

	const sequences = sortSequencesBySegment(activeIsolate.sequences, otu.schema);

	let sequenceComponents = sequences.map((sequence) => (
		<Sequence
			key={sequence.id}
			{...sequence}
			onEdit={() => setSequenceToEdit(sequence)}
			onDelete={() => setSequenceToDelete(sequence)}
		/>
	));

	let isolateName = `${activeIsolate.sourceType} ${activeIsolate.sourceName}`;
	isolateName = (isolateName[0] ?? "").toUpperCase() + isolateName.slice(1);

	const hasSequences = sequenceComponents.length > 0;

	if (!hasSequences) {
		sequenceComponents = [
			<BoxGroupSection key="noSequences">
				<Empty className="h-72">
					<EmptyMedia className="text-gray-400">
						<Dna size={40} strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>No sequences found</EmptyTitle>
					<EmptyDescription>
						This isolate has no sequences yet.
					</EmptyDescription>
				</Empty>
			</BoxGroupSection>,
		];
	}

	return (
		<>
			<div className="flex items-center font-medium mb-2">
				<strong className="text-base pr-1">Sequences</strong>
				<Badge>{sequences.length}</Badge>
			</div>

			<BoxGroup>
				{hasSequences && <SequenceListHeader />}
				{sequenceComponents}
			</BoxGroup>

			<CreateSequence
				isolateId={activeIsolate.id}
				open={openCreate && !archived}
				otuId={otuId}
				refId={String(reference.id)}
				schema={otu.schema}
				sequences={sequences}
				setOpen={setOpenCreate}
			/>

			<SequenceEdit
				activeSequence={sequenceToEdit}
				isolateId={activeIsolate.id}
				open={Boolean(sequenceToEdit) && !archived}
				otuId={otuId}
				refId={String(reference.id)}
				schema={otu.schema}
				sequences={sequences}
				setOpen={(open) => {
					if (!open) {
						setSequenceToEdit(undefined);
					}
				}}
			/>
			<DeleteSequence
				isolateId={activeIsolate.id}
				isolateName={isolateName}
				otuId={otuId}
				open={Boolean(sequenceToDelete) && !archived}
				sequence={sequenceToDelete}
				setOpen={(open) => {
					if (!open) {
						setSequenceToDelete(undefined);
					}
				}}
			/>
		</>
	);
}
