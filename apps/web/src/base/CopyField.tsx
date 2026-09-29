import { writeToClipboard } from "@app/clipboard";
import Button from "@base/Button";
import Field, { FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { useState } from "react";

type CopyFieldProps = {
	/** The visible label, which also names the read-only input. */
	label: string;

	/** Called after the value is written to the clipboard. */
	onCopy?: () => void;

	/** The exact text shown and copied. */
	value: string;
};

type CopyResult = { value: string; status: "copied" | "failed" };

/**
 * A labelled read-only value with a copy button.
 *
 * The button shows outside a secure context too. There the write fails, and
 * the status line tells the user to copy the selected text by hand.
 */
export default function CopyField({ label, onCopy, value }: CopyFieldProps) {
	const [result, setResult] = useState<CopyResult | null>(null);

	// A result for an earlier value must not describe a replacement value.
	const status = result?.value === value ? result.status : null;

	async function copy() {
		try {
			await writeToClipboard(value);
			setResult({ value, status: "copied" });
			onCopy?.();
		} catch {
			setResult({ value, status: "failed" });
		}
	}

	return (
		<Field className="mb-0 pb-0">
			<FieldLabel>{label}</FieldLabel>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					className="min-w-0 flex-1 font-mono text-sm"
					readOnly
					value={value}
					onFocus={(event) => event.target.select()}
				/>
				<Button color="blue" className="shrink-0" onClick={() => void copy()}>
					Copy
				</Button>
			</div>
			<p role="status" className="mt-1 min-h-5 text-sm text-gray-600">
				{status === "copied" && "Copied to clipboard."}
				{status === "failed" &&
					"Could not copy. Select the text and copy it manually."}
			</p>
		</Field>
	);
}
