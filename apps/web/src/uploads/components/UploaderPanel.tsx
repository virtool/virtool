import { byteSize } from "@app/format";
import { formatRoundedDuration } from "@app/utils";
import Badge from "@base/Badge";
import { IconButton } from "@base/Icon";
import { X } from "lucide-react";
import type { ReactElement } from "react";
import type { UploadInProgress } from "../types";
import { UploaderItem } from "./UploaderItem";

type UploaderPanelProps = {
	/** Close the panel. */
	onClose: () => void;

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
	onClose,
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
		<div className="overflow-hidden rounded-md">
			<div className="bg-slate-100 p-4">
				<div className="flex items-center justify-between mb-2">
					<div className="flex gap-1.5 font-medium items-center text-xl">
						<span>Uploads</span>
						<Badge>{uploads.length}</Badge>
					</div>
					<IconButton IconComponent={X} tip="Close" onClick={onClose} />
				</div>
				<div className="flex justify-between text-gray-500">
					{uploads.every((upload) => upload.progress === 100) ? (
						<>Finishing uploads</>
					) : (
						<>
							{formattedRemaining && (
								<span>{formattedRemaining} remaining</span>
							)}
							<span>{formattedSpeed}/s</span>
						</>
					)}
				</div>
			</div>
			<div className="max-h-96 overflow-y-auto">
				{uploads.map((upload) => (
					<UploaderItem key={upload.localId} {...upload} />
				))}
			</div>
		</div>
	);
}
