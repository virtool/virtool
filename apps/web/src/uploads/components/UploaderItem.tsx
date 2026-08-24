import { cn } from "@app/cn";
import { byteSize } from "@app/format";
import { IconButton } from "@base/Icon";
import Loader from "@base/Loader";
import ProgressBarAffixed from "@base/ProgressBarAffixed";
import { RotateCw, Trash, X } from "lucide-react";
import type { ReactNode } from "react";
import { cancelUpload, retryUpload } from "../uploader";

export type UploaderItemProps = {
	/* A human-readable reason the upload failed, when `failed` is true */
	error?: string;

	/* Whether the upload failed */
	failed: boolean;

	/* Local id of the file being uploaded */
	localId: string;

	/* Name of the file being uploaded */
	name: string;

	/* Progress of the upload in percentage */
	progress: number;

	/* Size of the file being uploaded */
	size: number;
};

/**
 * Progress tracker for a single uploaded file
 */
export function UploaderItem({
	error,
	failed,
	localId,
	name,
	progress,
	size,
}: UploaderItemProps) {
	let end: ReactNode;

	if (failed) {
		end = (
			<span className="flex font-medium gap-2 items-center text-red-500">
				<span>{error ?? "Failed"}</span>
				<IconButton
					IconComponent={RotateCw}
					color="blue"
					tip="Retry"
					onClick={() => retryUpload(localId)}
				/>
				<IconButton
					IconComponent={Trash}
					color="red"
					tip="Remove"
					onClick={() => cancelUpload(localId)}
				/>
			</span>
		);
	} else if (progress === 100) {
		end = <Loader className="size-4" />;
	} else {
		end = (
			<span className="flex gap-2 items-center text-gray-500">
				<span>{byteSize(size, true)}</span>
				<IconButton
					IconComponent={X}
					color="gray"
					tip="Cancel"
					onClick={() => cancelUpload(localId)}
				/>
			</span>
		);
	}

	return (
		<div className="relative p-0">
			<ProgressBarAffixed now={progress} color={failed ? "red" : "blue"} />
			<div className="flex justify-between p-4">
				<span className={cn("font-medium", { "text-red-500": failed })}>
					{name}
				</span>
				{end}
			</div>
		</div>
	);
}
