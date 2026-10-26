import { formatIsolateName } from "@app/utils";
import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import { useListSelection } from "@base/useListSelection";
import { useCurrentOtuContext } from "@otus/components/CurrentOtuContext";
import OtuExport from "@otus/components/Detail/OtuExport";
import { describeExportRows } from "@otus/export";
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

type SequenceListHeaderProps = {
	/** Whether every, some, or no sequence is selected */
	checked: boolean | "indeterminate";
	/** Called to select or deselect every sequence */
	onSelectAll: () => void;
};

/**
 * Column headings for the sequence list, aligned to each row's cells, after a
 * select-all checkbox.
 */
function SequenceListHeader({ checked, onSelectAll }: SequenceListHeaderProps) {
	return (
		<BoxGroupSection className="flex items-center gap-4 bg-gray-50 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
			<Checkbox
				ariaLabel="Select all sequences"
				checked={checked}
				onClick={onSelectAll}
			/>
			<span className="flex flex-1 items-center min-w-0">
				<span aria-hidden className={SEQUENCE_CHEVRON_COLUMN} />
				<span className={SEQUENCE_ACCESSION_COLUMN}>Accession</span>
				<span className={SEQUENCE_SEGMENT_COLUMN}>Segment</span>
				<span className={SEQUENCE_DEFINITION_COLUMN}>Definition</span>
			</span>
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

	// Each isolate starts with an empty selection.
	const selection = useListSelection<OtuSequence>({
		getKey: (sequence) => sequence.id,
		resetKey: activeIsolate.id,
	});

	const selectedSequences = sequences.filter(selection.isSelected);

	let sequenceComponents = sequences.map((sequence) => (
		<Sequence
			key={sequence.id}
			{...sequence}
			onEdit={() => setSequenceToEdit(sequence)}
			onDelete={() => setSequenceToDelete(sequence)}
			onSelect={(event) =>
				selection.select(sequence, {
					shiftKey: event.shiftKey,
					visibleItems: sequences,
				})
			}
			selected={selection.isSelected(sequence)}
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
			<div className="flex items-center gap-1 font-medium mb-2">
				<strong className="text-base">Sequences</strong>
				<Badge>{sequences.length}</Badge>
				{selectedSequences.length > 0 && (
					<span className="ml-2 text-sm text-gray-500">
						{selectedSequences.length} selected
					</span>
				)}
				<div className="ml-auto">
					<OtuExport
						description={describeExportRows(
							selectedSequences.length,
							sequences.length,
							sequences.length,
							"sequence",
						)}
						filenameParts={[otu.name, formatIsolateName(activeIsolate)]}
						includeIsolateTable={false}
						isolates={[
							{
								...activeIsolate,
								sequences: selectedSequences.length
									? selectedSequences
									: sequences,
							},
						]}
						otu={otu}
					/>
				</div>
			</div>

			<BoxGroup>
				{hasSequences && (
					<SequenceListHeader
						checked={selection.getVisibleState(sequences)}
						onSelectAll={() => selection.toggleVisible(sequences)}
					/>
				)}
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
