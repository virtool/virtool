import { cn } from "@app/cn";
import BoxGroupSection from "@base/BoxGroupSection";
import IconButton from "@base/IconButton";
import Label from "@base/Label";
import Tooltip from "@base/Tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OtuSegment } from "@virtool/contracts";
import { GripVertical, Pencil, Trash } from "lucide-react";
import type { ComponentProps, CSSProperties, Ref } from "react";

type SegmentItemProps = {
	/** Whether the user has permission to modify the otu */
	canModify: boolean;
	className?: string;
	/** Props spread onto the drag handle; omitted renders a static handle */
	dragHandleProps?: ComponentProps<"button">;
	/** A callback fired when the user requests segment removal */
	onDelete: () => void;
	ref?: Ref<HTMLDivElement>;
	segment: OtuSegment;
	setEditSegmentName: (name: string) => void;
	style?: CSSProperties;
};

/**
 * The presentational segment row, shared by the sortable list item and the
 * drag overlay.
 */
export function SegmentItem({
	canModify,
	className,
	dragHandleProps,
	onDelete,
	ref,
	segment,
	setEditSegmentName,
	style,
}: SegmentItemProps) {
	return (
		<BoxGroupSection
			ref={ref}
			className={cn("flex items-center gap-3 h-12", className)}
			style={style}
		>
			{canModify && (
				<Tooltip tip="drag to reorder">
					<button
						type="button"
						aria-label="drag to reorder"
						className="flex items-center justify-center p-2.5 text-gray-500 hover:text-gray-600 cursor-grab active:cursor-grabbing outline-none"
						{...dragHandleProps}
					>
						<GripVertical size="1.2em" />
					</button>
				</Tooltip>
			)}

			<span className="flex-1 truncate font-medium">{segment.name}</span>

			<div className="w-20 flex justify-start">
				{segment.required ? (
					<Label color="purple">Required</Label>
				) : (
					<Label>Optional</Label>
				)}
			</div>

			{canModify && (
				<div className="flex">
					<IconButton
						IconComponent={Pencil}
						color="gray"
						tip="edit segment"
						onClick={() => setEditSegmentName(segment.name)}
					/>
					<IconButton
						IconComponent={Trash}
						color="red"
						tip="delete segment"
						onClick={onDelete}
					/>
				</div>
			)}
		</BoxGroupSection>
	);
}

type SegmentProps = {
	/** Whether the user has permission to modify the otu */
	canModify: boolean;
	/** A callback fired when the user requests segment removal */
	onDelete: () => void;
	segment: OtuSegment;
	setEditSegmentName: (name: string) => void;
};

/**
 * A condensed, sortable segment item for use in a list of segments
 */
export default function Segment({
	canModify,
	onDelete,
	segment,
	setEditSegmentName,
}: SegmentProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: segment.name, disabled: !canModify });

	return (
		<SegmentItem
			ref={setNodeRef}
			canModify={canModify}
			className={cn(isDragging && "opacity-40")}
			dragHandleProps={{ ...attributes, ...listeners }}
			onDelete={onDelete}
			segment={segment}
			setEditSegmentName={setEditSegmentName}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		/>
	);
}
