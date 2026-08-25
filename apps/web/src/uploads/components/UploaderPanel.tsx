import { byteSize } from "@app/format";
import { formatRoundedDuration } from "@app/utils";
import Badge from "@base/Badge";
import { IconButton } from "@base/Icon";
import { Ban, X } from "lucide-react";
import type { ReactElement } from "react";
import type { UploadInProgress } from "../types";
import { cancelAll, setOpen } from "../uploader";
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
 * The upload tracking card anchored to the bottom-right corner.
 *
 * It stays put until every upload settles; completed uploads linger with a
 * check until they are cleared. `UploadOverlay` positions it and controls its
 * visibility through the shared store.
 */
export default function UploaderPanel({
	remaining,
	speed,
	uploads,
}: UploaderPanelProps): ReactElement | null {
	if (uploads.length === 0) {
		return null;
	}

	const active = uploads.filter(
		(upload) => !upload.completed && !upload.failed,
	);
	const allCompleted = uploads.every((upload) => upload.completed);

	const formattedRemaining = formatRoundedDuration(remaining);
	const formattedSpeed = byteSize(speed, true);

	let status: ReactElement;

	if (allCompleted) {
		status = <span className="text-green-600">Uploads complete</span>;
	} else if (
		active.length > 0 &&
		active.every((upload) => upload.progress === 100)
	) {
		status = <span>Finishing uploads</span>;
	} else {
		status = (
			<>
				<span>
					{formattedRemaining ? `${formattedRemaining} remaining` : ""}
				</span>
				<span>{formattedSpeed}/s</span>
			</>
		);
	}

	return (
		<div className="overflow-hidden rounded-md border border-slate-300 bg-white text-sm shadow-lg">
			<div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2 text-base">
				<div className="flex items-center gap-1.5 font-medium">
					<span>Uploads</span>
					<Badge>{uploads.length}</Badge>
				</div>
				<div className="flex items-center gap-2">
					<IconButton
						IconComponent={Ban}
						color="gray"
						tip="Cancel all"
						onClick={() => cancelAll()}
					/>
					<IconButton
						IconComponent={X}
						color="gray"
						tip="Hide"
						onClick={() => setOpen(false)}
					/>
				</div>
			</div>
			<div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-1 text-gray-500">
				{status}
			</div>
			<div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
				{uploads.map((upload) => (
					<UploaderItem key={upload.localId} {...upload} />
				))}
			</div>
		</div>
	);
}
