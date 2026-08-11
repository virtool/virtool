import { cn } from "@app/cn";
import Button from "@base/Button";
import Icon from "@base/Icon";
import { Upload } from "lucide-react";
import type { ReactNode } from "react";
import { type Accept, type FileError, useDropzone } from "react-dropzone";

type UploadBarProps = {
	accept?: Accept;

	/** A note shown under the prompt, describing the accepted file types */
	hint?: ReactNode;

	/** Replaces the drag-and-drop prompt, for showing upload status instead */
	message?: ReactNode;

	/** Whether multiple uploads can be uploaded */
	multiple?: boolean;

	/** Callback when the upload bar loses focus */
	onBlur?: () => void;

	/** Callback when uploads are dropped */
	onDrop: (acceptedFiles: File[]) => void;

	/** A regular expression to validate file names */
	regex?: RegExp;
};

/*
 * Allows uploads to be dragged and dropped or selected from the file system.
 */
export function UploadBar({
	accept,
	hint,
	message,
	multiple = true,
	onBlur,
	onDrop,
	regex,
}: UploadBarProps) {
	function validator(file: File): FileError | null {
		if (!regex) {
			return null;
		}

		if (!regex.test(file.name)) {
			return {
				code: "file-invalid-type",
				message: "Invalid file type",
			};
		}

		return null;
	}

	const {
		fileRejections,
		getRootProps,
		getInputProps,
		isDragAccept,
		isDragReject,
		isDragUnknown,
		open,
	} = useDropzone({
		accept,
		onDrop,
		validator,
	});

	// The drag-and-drop spec withholds file names until drop, so a dropzone with
	// a validator reports `isDragUnknown` instead of `isDragAccept` — the regex
	// cannot run yet. Highlight the bar as a drop target either way; a name that
	// fails the regex is reported under it once the files land.
	const isDragWelcome = isDragAccept || isDragUnknown;

	const rootProps = getRootProps({
		onClick: (e) => e.stopPropagation(),
	});

	return (
		<div
			className={cn(
				{
					"bg-blue-100": isDragWelcome,
					"bg-blue-50": !isDragWelcome && !isDragReject,
					"bg-red-100": isDragReject,
				},
				"border",
				"border-dashed",
				{
					"border-blue-300": !isDragReject,
					"border-red-400": isDragReject,
				},
				"flex",
				"flex-col",
				"items-center",
				"mb-4",
				"p-2",
				"pt-10",
				"rounded-md",
			)}
			{...rootProps}
		>
			<input
				{...getInputProps()}
				aria-label="Upload file"
				multiple={multiple}
			/>
			<div className="gap-2 grid grid-cols-11 place-items-stretch">
				<div className="col-span-5 flex items-center justify-end">
					<div className="flex flex-col gap-1 items-center">
						<span className="font-medium text-lg">
							{message ??
								(multiple
									? "Drag files here to upload"
									: "Drag a file here to upload")}
						</span>
						{hint && <span className="text-gray-600 text-sm">{hint}</span>}
					</div>
				</div>
				<div className="col-span-1 flex font-bold items-center justify-center text-gray-600">
					OR
				</div>
				<div className="col-span-5 flex items-center justify-start">
					<Button color="blue" onBlur={onBlur} onClick={open}>
						<Icon icon={Upload} /> Browse Files
					</Button>
				</div>
			</div>
			<div className="font-medium h-6 mt-4 text-red-600 text-sm">
				{fileRejections.length > 0 &&
					`Invalid file names: ${fileRejections.map(({ file }) => file.name).join(", ")}`}
			</div>
		</div>
	);
}
