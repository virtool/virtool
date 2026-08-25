import { cn } from "@app/cn";
import { CloudUpload } from "lucide-react";
import type { ReactElement } from "react";
import { toggleOpen, useUploaderStore } from "../uploader";

/**
 * A nav-bar button showing aggregate upload progress.
 *
 * It is always present while uploads are tracked and toggles the detail card
 * anchored to the bottom-right corner (`UploadOverlay`). The card shows itself
 * when uploads begin, so this is the way back to it once hidden.
 */
export default function UploadIndicator(): ReactElement | null {
	const uploads = useUploaderStore((state) => state.uploads);
	const open = useUploaderStore((state) => state.open);

	if (uploads.length === 0) {
		return null;
	}

	const { loaded, total } = uploads.reduce(
		(acc, upload) => ({
			loaded: acc.loaded + upload.loaded,
			total: acc.total + upload.size,
		}),
		{ loaded: 0, total: 0 },
	);

	const percent = total === 0 ? 0 : Math.round((loaded / total) * 100);
	const failed = uploads.some((upload) => upload.failed);
	const allCompleted = uploads.every((upload) => upload.completed);

	return (
		<button
			type="button"
			aria-label="Uploads"
			aria-pressed={open}
			onClick={() => toggleOpen()}
			className={cn(
				"flex gap-2 items-center rounded-md px-2 py-1 text-sm text-white",
				"hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
			)}
		>
			<CloudUpload
				size="1.2em"
				className={cn({
					"text-red-300": failed,
					"text-green-300": !failed && allCompleted,
				})}
			/>
			<span className="font-medium tabular-nums">{percent}%</span>
		</button>
	);
}
