import { cn } from "@app/cn";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	type Modifier,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PATHOSCOPE_COLUMNS, type PathoscopeColumn } from "@virtool/contracts";
import { GripVertical } from "lucide-react";
import { useState } from "react";

const columnLabels: Record<PathoscopeColumn, string> = {
	coverage: "Coverage",
	depth: "Depth",
	name: "Name",
	weight: "Weight / Reads",
};

const DIVIDER = "divider";

/** An entry in the column list: a column, or the line above the hidden ones. */
type Item = PathoscopeColumn | typeof DIVIDER;

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
	...transform,
	x: 0,
});

/**
 * Move an item onto the position of another. Columns above the divider are
 * exported and columns below it are hidden. At least one column stays above
 * the divider, because an export without columns is empty.
 */
export function moveColumn(order: Item[], active: Item, over: Item): Item[] {
	const next = arrayMove(order, order.indexOf(active), order.indexOf(over));

	return next.indexOf(DIVIDER) === 0 ? order : next;
}

function ColumnLabel({ column }: { column: PathoscopeColumn }) {
	return <span className="flex-1 font-medium">{columnLabels[column]}</span>;
}

type ColumnRowProps = {
	column: PathoscopeColumn;
	hidden: boolean;
};

function ColumnRow({ column, hidden }: ColumnRowProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: column });

	return (
		<BoxGroupSection
			className={cn(
				"flex h-12 items-center gap-3 pl-3.5",
				hidden && "text-gray-400",
				isDragging && "opacity-40",
			)}
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button
				aria-label={`Move ${columnLabels[column]}`}
				className="flex cursor-grab items-center justify-center p-2.5 text-gray-500 outline-none hover:text-gray-600 active:cursor-grabbing"
				type="button"
				{...attributes}
				{...listeners}
			>
				<GripVertical size="1.2em" />
			</button>
			<ColumnLabel column={column} />
		</BoxGroupSection>
	);
}

function Divider({ empty }: { empty: boolean }) {
	const { setNodeRef, transform, transition } = useSortable({
		disabled: { draggable: true, droppable: false },
		id: DIVIDER,
	});

	return (
		<BoxGroupSection
			className="flex h-12 items-center justify-between gap-3 bg-gray-50 text-gray-600 text-sm"
			ref={setNodeRef}
			role="separator"
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<span className="font-medium">Hidden columns</span>
			{empty && (
				<span className="text-gray-400">
					Drag a column below this line to leave it out
				</span>
			)}
		</BoxGroupSection>
	);
}

type PathoscopeColumnsProps = {
	/** The shown columns, in order */
	columns: PathoscopeColumn[];
	/** Saves the columns; `onSettled` runs once the save has finished */
	onChange: (
		columns: PathoscopeColumn[],
		options: { onSettled: () => void },
	) => void;
};

/**
 * A list for choosing which Pathoscope export columns to carry and in what
 * order. Columns drag to reorder, and below a divider to leave them out.
 */
export default function PathoscopeColumns({
	columns,
	onChange,
}: PathoscopeColumnsProps) {
	// The dropped order must render in the same commit that dnd-kit drops its
	// transforms, or the rows snap back before the query cache catches up.
	const [pending, setPending] = useState<PathoscopeColumn[] | null>(null);
	const [active, setActive] = useState<PathoscopeColumn | null>(null);

	const shown = pending ?? columns;
	const order: Item[] = [
		...shown,
		DIVIDER,
		...PATHOSCOPE_COLUMNS.filter((column) => !shown.includes(column)),
	];
	const dividerIndex = order.indexOf(DIVIDER);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	function handleDragStart({ active }: DragStartEvent) {
		setActive(active.id as PathoscopeColumn);
	}

	function handleDragEnd({ active, over }: DragEndEvent) {
		setActive(null);

		if (!over) {
			return;
		}

		const next = moveColumn(order, active.id as Item, over.id as Item);
		const nextShown = next.slice(
			0,
			next.indexOf(DIVIDER),
		) as PathoscopeColumn[];

		if (nextShown.join() !== shown.join()) {
			setPending(nextShown);
			onChange(nextShown, { onSettled: () => setPending(null) });
		}
	}

	return (
		<DndContext
			collisionDetection={closestCenter}
			modifiers={[restrictToVerticalAxis]}
			onDragCancel={() => setActive(null)}
			onDragEnd={handleDragEnd}
			onDragStart={handleDragStart}
			sensors={sensors}
		>
			<SortableContext items={order} strategy={verticalListSortingStrategy}>
				<BoxGroup>
					{order.map((item, index) =>
						item === DIVIDER ? (
							<Divider empty={dividerIndex === order.length - 1} key={item} />
						) : (
							<ColumnRow
								column={item}
								hidden={index > dividerIndex}
								key={item}
							/>
						),
					)}
				</BoxGroup>
			</SortableContext>
			<DragOverlay>
				{active && (
					<BoxGroup className="mb-0 shadow-lg">
						<BoxGroupSection
							className={cn(
								"flex h-12 cursor-grabbing items-center gap-3 bg-white pl-3.5",
								order.indexOf(active) > dividerIndex && "text-gray-400",
							)}
						>
							<span className="p-2.5 text-gray-500">
								<GripVertical size="1.2em" />
							</span>
							<ColumnLabel column={active} />
						</BoxGroupSection>
					</BoxGroup>
				)}
			</DragOverlay>
		</DndContext>
	);
}
