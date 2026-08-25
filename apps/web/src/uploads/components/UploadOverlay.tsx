import type { ReactElement } from "react";
import { useUploaderStore } from "../uploader";
import UploaderPanel from "./UploaderPanel";

/**
 * Positions the upload tracking card in the bottom-right corner.
 *
 * The card shows itself when uploads begin and stays until it is hidden with
 * the nav-bar indicator (`UploadIndicator`). It never dismisses on its own.
 */
export default function UploadOverlay(): ReactElement | null {
	const uploads = useUploaderStore((state) => state.uploads);
	const open = useUploaderStore((state) => state.open);
	const remaining = useUploaderStore((state) => state.remaining);
	const speed = useUploaderStore((state) => state.speed);

	if (uploads.length === 0 || !open) {
		return null;
	}

	return (
		<div className="fixed bottom-0 right-0 z-toast w-96 pr-4 pb-4">
			<UploaderPanel remaining={remaining} speed={speed} uploads={uploads} />
		</div>
	);
}
