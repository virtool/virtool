import { byteSize } from "@app/format";
import { formatRoundedDuration } from "@app/utils";
import type { ReactElement } from "react";
import type { UploadInProgress } from "../types";
import { UploaderItem } from "./UploaderItem";

type UploaderPanelProps = {
	/** Total upload time remaining in seconds */
	remaining: number;

	/** Current estimated upload speed in bytes */
	speed: number;

	/** The list of uploads */
	uploads: UploadInProgress[];
};

/**
 * A panel that displays the progress of file uploads.
 *
 * This component is the content of the popover anchored to the nav-bar upload
 * indicator in `UploadIndicator`, which owns the upload state and visibility.
 */
export default function UploaderPanel({
	remaining,
	speed,
	uploads,
}: UploaderPanelProps): ReactElement | null {
	if (uploads.length === 0) {
		return null;
	}

	const formattedRemaining = formatRoundedDuration(remaining);

	const formattedSpeed = byteSize(speed, true);

	return (
		<div className="overflow-hidden rounded-md text-sm">
			<div className="flex gap-3 items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-gray-500">
				{uploads.every((upload) => upload.progress === 100) ? (
					<span>Finishing uploads</span>
				) : (
					<>
						<span>
							{formattedRemaining ? `${formattedRemaining} remaining` : ""}
						</span>
						<span>{formattedSpeed}/s</span>
					</>
				)}
			</div>
			<div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
				{uploads.map((upload) => (
					<UploaderItem key={upload.localId} {...upload} />
				))}
			</div>
		</div>
	);
}
