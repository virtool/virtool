import { cn } from "@app/cn";
import Icon from "@base/Icon";
import type { Upload } from "@virtool/contracts";
import { ArrowLeftRight } from "lucide-react";
import ReadSlot from "./ReadSlot";

type ReadSelectorSlotsProps = {
	/** The current selection, in [LEFT, RIGHT] order */
	selected: number[];
	/** Loaded uploads used to resolve file names */
	items: Upload[];
	/** Reverses the LEFT and RIGHT reads */
	onSwap: () => void;
	/** Whether to show the swap control (Manual mode only) */
	showSwap: boolean;
};

/**
 * The two ordered LEFT / RIGHT slots showing the current read selection. One
 * filled slot is a single-end sample; two is paired-end. In Manual mode a
 * control to swap their order is shown; Auto-pair assigns order from detection
 * and needs no swap.
 */
export default function ReadSelectorSlots({
	selected,
	items,
	onSwap,
	showSwap,
}: ReadSelectorSlotsProps) {
	function getSlot(id?: number) {
		const file =
			id === undefined ? undefined : items.find((it) => it.id === id);

		return { file, missing: id !== undefined && file === undefined };
	}

	const left = getSlot(selected[0]);
	const right = getSlot(selected[1]);

	return (
		<div className="flex items-stretch gap-2 mb-4">
			<ReadSlot
				file={left.file}
				label="LEFT"
				missing={left.missing}
				placeholder="No file selected"
				sub="R1"
			/>
			{showSwap && (
				<button
					type="button"
					aria-label="Swap reads"
					disabled={selected.length < 2}
					onClick={onSwap}
					className={cn(
						"shrink-0 self-center rounded-md border border-gray-300 p-2 text-gray-600",
						"hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent",
						"focus:outline-none focus:ring-2 focus:ring-blue-600/50",
					)}
				>
					<Icon icon={ArrowLeftRight} />
				</button>
			)}
			<ReadSlot
				file={right.file}
				label="RIGHT"
				missing={right.missing}
				placeholder="Optional — add a second file for paired reads"
				sub="R2"
			/>
		</div>
	);
}
