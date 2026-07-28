import { cn } from "@app/cn";
import { byteSize } from "@app/format";
import Icon from "@base/Icon";
import type { ReadRow } from "@uploads/pairing";
import type { Upload } from "@virtool/contracts";
import { File, Files } from "lucide-react";

type SlotLabel = "LEFT" | "RIGHT";

/**
 * Returns the slot a file occupies in the current selection, or null when it is
 * not selected. Index 0 is the LEFT (R1) read and index 1 is the RIGHT (R2)
 * read.
 */
function slotFor(id: number, selected: number[]): SlotLabel | null {
	const index = selected.indexOf(id);

	if (index === 0) {
		return "LEFT";
	}

	if (index === 1) {
		return "RIGHT";
	}

	return null;
}

type SlotBadgeProps = {
	label: SlotLabel | "R1" | "R2";
	muted?: boolean;
};

function SlotBadge({ label, muted }: SlotBadgeProps) {
	return (
		<span
			className={cn(
				"rounded-md text-xs font-bold text-center w-12 py-0.5 shrink-0",
				muted ? "bg-gray-100 text-gray-500" : "bg-blue-700 text-white",
			)}
		>
			{label}
		</span>
	);
}

type FileButtonProps = {
	file: Upload;
	selected: number[];
	onSelect: (id: number) => void;
};

/** A single selectable read file. */
function FileButton({ file, selected, onSelect }: FileButtonProps) {
	const slot = slotFor(file.id, selected);
	const isSelected = slot !== null;

	return (
		<button
			type="button"
			aria-pressed={isSelected}
			onClick={() => onSelect(file.id)}
			className={cn(
				"flex w-full cursor-pointer items-center gap-3 px-6 py-3 text-left select-none",
				"border-b border-gray-300 last:border-b-0",
				"focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600/50",
				isSelected && "bg-blue-50",
			)}
		>
			<Icon icon={File} color="gray" className="shrink-0" />
			<div className="min-w-0 flex-grow truncate font-mono font-medium">
				{file.name}
			</div>
			<div className="shrink-0 text-sm text-gray-500">
				{byteSize(file.size)}
			</div>
			{slot ? <SlotBadge label={slot} /> : <SlotBadge label="R1" muted />}
		</button>
	);
}

type PairLineProps = {
	file: Upload;
	hint: "R1" | "R2";
	selected: number[];
};

/** One filename line within a pair row. */
function PairLine({ file, hint, selected }: PairLineProps) {
	const slot = slotFor(file.id, selected);

	return (
		<div className="flex items-center gap-3">
			<div className="min-w-0 flex-grow truncate font-mono font-medium">
				{file.name}
			</div>
			<div className="shrink-0 text-sm text-gray-500">
				{byteSize(file.size)}
			</div>
			{slot ? <SlotBadge label={slot} /> : <SlotBadge label={hint} muted />}
		</div>
	);
}

type ReadSelectorRowProps = {
	/** The row to render */
	row: ReadRow;
	/** The current selection, in [LEFT, RIGHT] order */
	selected: number[];
	/** Toggles a single file in the selection */
	onSelectSingle: (id: number) => void;
	/** Selects a detected pair, assigning LEFT and RIGHT */
	onSelectPair: (leftId: number, rightId: number) => void;
};

/**
 * A row in the read selector: a single file, or a detected mate pair that is
 * selected as a unit.
 */
export default function ReadSelectorRow({
	row,
	selected,
	onSelectSingle,
	onSelectPair,
}: ReadSelectorRowProps) {
	if (row.kind === "single") {
		return (
			<FileButton
				file={row.file}
				selected={selected}
				onSelect={onSelectSingle}
			/>
		);
	}

	const { left, right } = row;
	const pairSelected =
		selected.includes(left.id) && selected.includes(right.id);

	return (
		<button
			type="button"
			aria-pressed={pairSelected}
			onClick={() => onSelectPair(left.id, right.id)}
			className={cn(
				"flex w-full cursor-pointer items-center gap-3 px-6 py-3 text-left select-none min-w-0",
				"border-b border-gray-300 last:border-b-0",
				"focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600/50",
				pairSelected && "bg-blue-50",
			)}
		>
			<Icon icon={Files} color="gray" className="shrink-0" />
			<div className="min-w-0 flex-grow space-y-1">
				<PairLine file={left} hint="R1" selected={selected} />
				<PairLine file={right} hint="R2" selected={selected} />
			</div>
		</button>
	);
}
