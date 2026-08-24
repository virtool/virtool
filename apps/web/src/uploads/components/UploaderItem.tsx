import { cn } from "@app/cn";
import { byteSize } from "@app/format";
import { IconButton } from "@base/Icon";
import Loader from "@base/Loader";
import ProgressBarAffixed from "@base/ProgressBarAffixed";
import { Trash } from "lucide-react";
import type { ReactNode } from "react";
import { useUploaderStore } from "../uploader";

export type UploaderItemProps = {
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
	failed,
	localId,
	name,
	progress,
	size,
}: UploaderItemProps) {
	const removeUpload = useUploaderStore((state) => state.removeUpload);

	let end: ReactNode;

	if (failed) {
		end = (
			<span className="flex font-medium gap-2">
				<span>Failed</span>
				<IconButton
					IconComponent={Trash}
					color="red"
					tip="Remove"
					onClick={() => removeUpload(localId)}
				/>
			</span>
		);
	} else if (progress === 100) {
		end = <Loader className="size-4" />;
	} else {
		end = byteSize(size, true);
	}

	return (
		<div className="relative p-0">
			<ProgressBarAffixed now={progress} color={failed ? "red" : "blue"} />
			<div className="flex justify-between p-4">
				<span className="font-medium">{name}</span>
				<span
					className={cn({
						"text-red-500": failed,
						"text-gray-500": !failed,
					})}
				>
					{end}
				</span>
			</div>
		</div>
	);
}
