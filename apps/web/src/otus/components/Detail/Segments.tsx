import Box, { BoxGroup } from "@base/Box";
import Button from "@base/Button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useFetchOtu, useUpdateOtu } from "@otus/queries";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import { getRouteApi } from "@tanstack/react-router";
import type { OtuSegment } from "@virtool/contracts";
import { Component } from "lucide-react";
import { useState } from "react";
import DeleteSegment from "./DeleteSegment";
import Segment, { SegmentItem } from "./Segment";
import SegmentCreate from "./SegmentCreate";
import SegmentEdit from "./SegmentEdit";

const routeApi = getRouteApi("/_authenticated/refs/$refId/otus/$otuId");

/**
 * Displays a component allowing users to manage the otu segments
 */
export default function Segments() {
	const { refId, otuId } = routeApi.useParams();
	const referenceId = Number(refId);
	const { hasPermission: canModify, isPending: isPendingPermission } =
		useCheckReferenceRight(referenceId, "modifyOtu");
	const archived = useReferenceIsArchived(referenceId);

	const { data, isPending, isError } = useFetchOtu(otuId);
	const mutation = useUpdateOtu(otuId);
	const [openAddSegment, setOpenAddSegment] = useState(false);
	const [segmentToEdit, setSegmentToEdit] = useState<string | undefined>();
	const [segmentToDelete, setSegmentToDelete] = useState<string | undefined>();
	const [activeSegmentName, setActiveSegmentName] = useState<string | null>(
		null,
	);
	const [pendingSchema, setPendingSchema] = useState<OtuSegment[] | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	if (isError && !data) {
		return <QueryError noun="schema" />;
	}

	if (isPending || isPendingPermission) {
		return <LoadingPlaceholder />;
	}

	const { abbreviation, name } = data;

	const schema = pendingSchema ?? data.schema;

	function handleDragStart({ active }: DragStartEvent) {
		setActiveSegmentName(String(active.id));
	}

	function handleDragEnd({ active, over }: DragEndEvent) {
		setActiveSegmentName(null);

		if (!over || active.id === over.id) {
			return;
		}

		const oldIndex = schema.findIndex((s) => s.name === active.id);
		const newIndex = schema.findIndex((s) => s.name === over.id);
		const reordered = arrayMove(schema, oldIndex, newIndex);

		// The reordered list must render in the same commit that dnd-kit drops
		// its transforms, or the items snap back before the query cache catches
		// up. React Query notifies observers asynchronously, so the optimistic
		// update in useUpdateOtu lands too late to be that source of truth.
		setPendingSchema(reordered);

		mutation.mutate(
			{ otuId, schema: reordered },
			{ onSettled: () => setPendingSchema(null) },
		);
	}

	const activeSegment = activeSegmentName
		? schema.find((s) => s.name === activeSegmentName)
		: undefined;

	return (
		<div>
			{archived ? (
				<p className="mb-3 text-sm text-gray-500">Read only - archived</p>
			) : (
				canModify && (
					<div className="flex justify-end mb-3">
						<Button color="blue" onClick={() => setOpenAddSegment(true)}>
							Create
						</Button>
					</div>
				)
			)}
			{schema.length ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
					onDragCancel={() => setActiveSegmentName(null)}
				>
					<SortableContext
						items={schema.map((segment) => segment.name)}
						strategy={verticalListSortingStrategy}
					>
						<BoxGroup>
							{schema.map((segment) => (
								<Segment
									key={segment.name}
									canModify={canModify && !archived}
									segment={segment}
									onDelete={() => setSegmentToDelete(segment.name)}
									setEditSegmentName={setSegmentToEdit}
								/>
							))}
						</BoxGroup>
					</SortableContext>
					<DragOverlay>
						{activeSegment ? (
							<BoxGroup className="mb-0 shadow-lg">
								<SegmentItem
									canModify={canModify && !archived}
									segment={activeSegment}
									onDelete={() => undefined}
									setEditSegmentName={() => undefined}
								/>
							</BoxGroup>
						) : null}
					</DragOverlay>
				</DndContext>
			) : (
				<Box>
					<Empty className="h-72">
						<EmptyMedia className="text-gray-400">
							<Component size={40} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No segments found</EmptyTitle>
						<EmptyDescription>
							This schema has no segments yet.
						</EmptyDescription>
					</Empty>
				</Box>
			)}

			<SegmentCreate
				abbreviation={abbreviation}
				name={name}
				otuId={otuId}
				open={openAddSegment && !archived}
				schema={schema}
				setOpen={setOpenAddSegment}
			/>
			<SegmentEdit
				abbreviation={abbreviation}
				editSegmentName={archived ? undefined : segmentToEdit}
				name={name}
				otuId={otuId}
				schema={schema}
				unsetEditSegmentName={() => setSegmentToEdit(undefined)}
			/>
			<DeleteSegment
				abbreviation={abbreviation}
				name={name}
				open={Boolean(segmentToDelete)}
				otuId={otuId}
				schema={schema}
				segmentName={segmentToDelete}
				setOpen={(open) => {
					if (!open) {
						setSegmentToDelete(undefined);
					}
				}}
			/>
		</div>
	);
}
