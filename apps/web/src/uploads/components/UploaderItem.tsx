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
			<>
				<span className="font-medium text-red-500">{error ?? "Failed"}</span>
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
			</>
		);
	} else if (progress === 100) {
		end = (
			<>
				<span className="tabular-nums text-gray-500">
					{byteSize(size, true)}
				</span>
				<span className="flex items-center justify-center size-9">
					<Loader className="size-4" />
				</span>
			</>
		);
	} else {
		end = (
			<>
				<span className="tabular-nums text-gray-500">
					{byteSize(size, true)}
				</span>
				<IconButton
					IconComponent={X}
					color="gray"
					tip="Cancel"
					onClick={() => cancelUpload(localId)}
				/>
			</>
		);
	}

	return (
		<div className="relative">
			<ProgressBarAffixed now={progress} color={failed ? "red" : "blue"} />
			<div className="flex gap-3 items-center justify-between min-h-13 px-3 py-1">
				<span
					className={cn("font-medium min-w-0 truncate", {
						"text-red-500": failed,
					})}
				>
					{name}
				</span>
				<span className="flex gap-2 items-center shrink-0">{end}</span>
			</div>
		</div>
	);
}
