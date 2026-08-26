import { writeToClipboard } from "@app/clipboard";
import { useIsSecureContext } from "@app/hooks";
import { toast } from "@base/Toast";
import * as Sentry from "@sentry/tanstackstart-react";
import { ClipboardPaste } from "lucide-react";
import type { ReactNode } from "react";

type CopyTextProps = {
	/** What is rendered in place — the reader-facing form of the value. */
	children: ReactNode;

	/** A short label identifying this copy site, forwarded to Sentry on failure. */
	tag: string;

	/** The exact text written to the clipboard, which need not match `children`. */
	value: string;
};

/**
 * Inline text that copies an exact value to the clipboard when clicked.
 *
 * The rendered `children` are the friendly form and the copied `value` the exact
 * one, so a relative time can be shown while an absolute one is copied. Outside a
 * secure context, where the clipboard cannot be reached, the text renders plain.
 */
export default function CopyText({ children, tag, value }: CopyTextProps) {
	const isSecureContext = useIsSecureContext();

	if (!isSecureContext) {
		return <>{children}</>;
	}

	// Only a resolved write raises the toast, so a rejected one — a revoked
	// permission, an unfocused document — cannot claim the value was copied.
	function handleCopy() {
		writeToClipboard(value).then(
			() =>
				toast({
					description: (
						<span className="flex items-start gap-2">
							<span className="flex h-5 shrink-0 items-center">
								<ClipboardPaste className="size-4" />
							</span>
							<span className="min-w-0">
								{`"${value}" copied to clipboard.`}
							</span>
						</span>
					),
				}),
			(error) => Sentry.captureException(error, { tags: { clipboard: tag } }),
		);
	}

	return (
		<button
			type="button"
			className="cursor-pointer underline decoration-dotted underline-offset-2"
			title="Copy to clipboard"
			onClick={handleCopy}
		>
			{children}
		</button>
	);
}
