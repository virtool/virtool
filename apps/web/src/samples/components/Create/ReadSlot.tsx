import { cn } from "@app/cn";
import Icon from "@base/Icon";
import type { Upload } from "@virtool/contracts";
import { TriangleAlert } from "lucide-react";

type ReadSlotProps = {
	/** The file held by the slot, when it is filled and still available */
	file?: Upload;

	/** The slot's position in the pair, eg. ``LEFT`` */
	label: string;

	/** Whether the slot holds a file that is no longer available */
	missing?: boolean;

	/** Shown when the slot is empty and can still be filled */
	placeholder?: string;

	/** The slot's read orientation, eg. ``R1`` */
	sub: string;
};

/**
 * One side of a read pair, showing the file that fills it. An empty slot shows
 * its placeholder, and a slot whose file has been removed since it was chosen
 * warns instead.
 */
export default function ReadSlot({
	file,
	label,
	missing = false,
	placeholder,
	sub,
}: ReadSlotProps) {
	return (
		<div
			className={cn(
				"flex-1 min-w-0 rounded-md border p-3",
				missing ? "border-amber-400 bg-amber-50" : "border-gray-300",
			)}
		>
			<div className="text-xs font-bold text-gray-500 tracking-wide">
				{label}
				<span className="ml-1 font-medium text-gray-500">{sub}</span>
			</div>
			{file && (
				<div className="truncate font-mono font-medium mt-1">{file.name}</div>
			)}
			{missing && (
				<div className="flex items-center gap-1.5 mt-1 text-amber-600 font-medium">
					<Icon icon={TriangleAlert} />
					This file is no longer available
				</div>
			)}
			{!file && !missing && placeholder && (
				<div className="mt-1 text-gray-500">{placeholder}</div>
			)}
		</div>
	);
}
