import { cn } from "@app/cn";
import Button from "@base/Button";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { getDeleteErrorMessage } from "./deleteError";

type DeleteDialogProps = {
	/** The display name of the item being deleted */
	name: string;
	/** The type of item being deleted (e.g. "Sample"); titles the dialog "Delete {noun}" */
	noun: string;
	/** Overrides the "Delete {noun}" title */
	title?: string;
	/** Overrides the "Confirm" button text */
	confirmLabel?: string;
	/** Overrides the default confirmation prompt */
	message?: ReactNode;
	/**
	 * Performs the deletion. Its result is awaited: a rejection renders inline
	 * and keeps the dialog open, while success closes it. A cancelled
	 * recent-authentication challenge keeps the dialog open without an error.
	 * The dialog cannot be confirmed again or dismissed until it settles.
	 */
	onConfirm: () => unknown;
	/** A trigger that opens the dialog (e.g. a delete IconButton). Omit when controlling `open`. */
	trigger?: ReactNode;
	/** Controlled open state. Omit to let `trigger` manage it. */
	open?: boolean;
	/** Notified whenever the open state changes. */
	onOpenChange?: (open: boolean) => void;
};

/**
 * A dialog that confirms deletion of a document or other sensitive item. Built
 * on an alert dialog, so an outside click cannot dismiss it, and it renders any
 * error thrown by `onConfirm` inline.
 */
export default function DeleteDialog({
	name,
	noun,
	title,
	confirmLabel = "Confirm",
	message,
	onConfirm,
	trigger,
	open: openProp,
	onOpenChange,
}: DeleteDialogProps) {
	const [openState, setOpenState] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const pendingRef = useRef(false);
	const openerRef = useRef<HTMLElement | null>(null);

	const isControlled = openProp !== undefined;
	const open = isControlled ? openProp : openState;

	function handleOpenChange(next: boolean) {
		if (!isControlled) {
			setOpenState(next);
		}
		if (!next) {
			setError(null);
		}
		onOpenChange?.(next);
	}

	async function handleConfirm() {
		// The ref catches a second click that lands before the disabled button
		// re-renders.
		if (pendingRef.current) {
			return;
		}

		pendingRef.current = true;
		setPending(true);
		setError(null);

		try {
			await onConfirm();
			handleOpenChange(false);
		} catch (caught) {
			setError(getDeleteErrorMessage(caught));
		} finally {
			pendingRef.current = false;
			setPending(false);
		}
	}

	function handleOpenAutoFocus() {
		openerRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
	}

	// Radix returns focus only to its own trigger ref. That ref is empty for a
	// controlled dialog and for a trigger that does not forward `ref`, so focus
	// would fall to the document body.
	function handleCloseAutoFocus(event: Event) {
		const opener = openerRef.current;
		openerRef.current = null;

		if (opener?.isConnected) {
			event.preventDefault();
			opener.focus();
		}
	}

	function handleEscapeKeyDown(event: KeyboardEvent) {
		if (pendingRef.current) {
			event.preventDefault();
		}
	}

	return (
		<AlertDialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
			{trigger && (
				<AlertDialogPrimitive.Trigger asChild>
					{trigger}
				</AlertDialogPrimitive.Trigger>
			)}
			<AlertDialogPrimitive.Portal>
				<AlertDialogPrimitive.Overlay
					className={cn(
						"data-[state=open]:animate-overlayShow",
						"data-[state=closed]:animate-overlayHide",
						"bg-gray-500/60",
						"fixed",
						"inset-0",
						"z-overlay",
					)}
				/>
				<AlertDialogPrimitive.Content
					onCloseAutoFocus={handleCloseAutoFocus}
					onEscapeKeyDown={handleEscapeKeyDown}
					onOpenAutoFocus={handleOpenAutoFocus}
					className={cn(
						"data-[state=open]:animate-contentShow",
						"data-[state=closed]:animate-contentHide",
						"fixed",
						"top-1/2",
						"left-1/2",
						"-translate-x-1/2",
						"-translate-y-1/2",
						"rounded-lg",
						"bg-white",
						"p-8",
						"shadow-2xl",
						"focus:outline-none",
						"z-dialog",
						"w-[600px]",
						"max-w-[90vw]",
						"max-h-[90vh]",
						"overflow-y-auto",
					)}
				>
					<AlertDialogPrimitive.Title className="font-medium pb-4 text-2xl">
						{title ?? `Delete ${noun}`}
					</AlertDialogPrimitive.Title>
					<AlertDialogPrimitive.Description>
						{message ?? (
							<>
								Are you sure you want to delete <strong>{name}</strong>?
							</>
						)}
					</AlertDialogPrimitive.Description>
					{error && (
						<p role="alert" className="mt-4 text-red-600">
							{error}
						</p>
					)}
					<div className="flex justify-end gap-2 pt-4 pb-1">
						<AlertDialogPrimitive.Cancel asChild>
							<Button color="gray" disabled={pending}>
								Cancel
							</Button>
						</AlertDialogPrimitive.Cancel>
						<Button color="red" disabled={pending} onClick={handleConfirm}>
							{confirmLabel}
						</Button>
					</div>
				</AlertDialogPrimitive.Content>
			</AlertDialogPrimitive.Portal>
		</AlertDialogPrimitive.Root>
	);
}
