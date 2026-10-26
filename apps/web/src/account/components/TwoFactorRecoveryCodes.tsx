import { writeToClipboard } from "@app/clipboard";
import { downloadText } from "@app/download";
import Alert from "@base/Alert";
import Button from "@base/Button";
import Checkbox from "@base/Checkbox";
import { DialogFooter } from "@base/Dialog";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

const RECOVERY_CODES_FILENAME = "virtool-recovery-codes.txt";

function formatCodes(codes: string[]): string {
	return codes.join("\n");
}

function downloadCodes(codes: string[]) {
	downloadText(
		`${formatCodes(codes)}\n`,
		RECOVERY_CODES_FILENAME,
		"text/plain",
	);
}

type TwoFactorRecoveryCodesProps = {
	/** Whether the user has said that they saved the codes */
	acknowledged: boolean;
	/** The one-time recovery codes */
	codes: string[];
	onAcknowledgedChange: (acknowledged: boolean) => void;
	onDone: () => void;
};

/**
 * Shows new recovery codes one time, with copy and download controls.
 *
 * The user must say that they saved the codes before they can continue.
 */
export default function TwoFactorRecoveryCodes({
	acknowledged,
	codes,
	onAcknowledgedChange,
	onDone,
}: TwoFactorRecoveryCodesProps) {
	const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(
		null,
	);

	async function copy() {
		try {
			await writeToClipboard(formatCodes(codes));
			setCopyStatus("copied");
		} catch {
			setCopyStatus("failed");
		}
	}

	return (
		<>
			<Alert color="orange" icon={TriangleAlert}>
				Save these codes now. You will not see them again. Each code signs you
				in one time if you cannot use your authenticator app.
			</Alert>
			<ul
				aria-label="Recovery codes"
				className="grid grid-cols-2 gap-2 rounded-md bg-gray-100 p-4 font-mono"
			>
				{codes.map((code) => (
					<li key={code}>{code}</li>
				))}
			</ul>
			<div className="mt-4 flex gap-2">
				<Button onClick={() => void copy()}>Copy all</Button>
				<Button onClick={() => downloadCodes(codes)}>Download</Button>
			</div>
			<p role="status" className="mt-1 min-h-5 text-sm text-gray-600">
				{copyStatus === "copied" && "Copied to clipboard."}
				{copyStatus === "failed" &&
					"Could not copy. Select the codes and copy them manually."}
			</p>
			<div className="mt-4">
				<Checkbox
					checked={acknowledged}
					label="I have saved these codes"
					onClick={() => onAcknowledgedChange(!acknowledged)}
				/>
			</div>
			<DialogFooter>
				<Button color="blue" disabled={!acknowledged} onClick={onDone}>
					Done
				</Button>
			</DialogFooter>
		</>
	);
}
