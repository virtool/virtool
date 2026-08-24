import { cn } from "@app/cn";
import { Dialog as DialogPrimitive } from "radix-ui";
import { type ReactElement, type ReactNode, useRef } from "react";

/**
 * Whether a viewport point falls within a rectangle, inclusive of its edges.
 */
function isPointWithinRect(x: number, y: number, rect: DOMRect): boolean {
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export const Dialog = DialogPrimitive.Root;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogTrigger = DialogPrimitive.Trigger;

/**
 * A styled semi-transparent overlay for a dialog
 */
export function DialogOverlay() {
	return (
		<DialogPrimitive.Overlay
			className={cn(
				"data-[state=open]:animate-overlayShow",
				"data-[state=closed]:animate-overlayHide",
				"bg-gray-500/60",
				"fixed",
				"inset-0",
				"z-overlay",
			)}
		/>
	);
}

type DialogContentProps = {
	children: ReactNode;
	className?: string;
	size?: "lg";
};

/**
 * A styled dialog content container with Portal and Overlay included
 */
export function DialogContent({
	children,
	className,
	size,
}: DialogContentProps) {
	const contentRef = useRef<HTMLDivElement>(null);

	return (
		<DialogPrimitive.Portal>
			<DialogOverlay />
			<DialogPrimitive.Content
				ref={contentRef}
				onPointerDownOutside={(event) => {
					// An open popover-style child (e.g. a Radix Select) sets
					// pointer-events:none on this content while it is open, so a
					// press on the dialog's own body falls through to the
					// full-screen overlay and reads as an outside press that would
					// close the dialog. A genuine outside press lands beyond the
					// content box, so ignore any press whose coordinates are inside
					// it — the child popover closes, the dialog stays open.
					const { clientX, clientY } = event.detail.originalEvent;
					const rect = contentRef.current?.getBoundingClientRect();

					if (rect && isPointWithinRect(clientX, clientY, rect)) {
						event.preventDefault();
					}
				}}
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
					{ "w-[900px]": size === "lg" },
					"max-w-[90vw]",
					"max-h-[90vh]",
					"overflow-y-auto",
					className,
				)}
			>
				{children}
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

type DialogTitleProps = {
	children: ReactNode;
	className?: string;
};

export function DialogTitle({ children, className }: DialogTitleProps) {
	return (
		<DialogPrimitive.Title
			className={cn("font-medium pb-4 text-2xl", className)}
		>
			{children}
		</DialogPrimitive.Title>
	);
}

type DialogDescriptionProps = {
	children: ReactNode;
};

export function DialogDescription({
	children,
}: DialogDescriptionProps): ReactElement {
	return (
		<DialogPrimitive.Description
			className={cn("font-medium", "pb-4", "text-lg", "text-slate-600")}
		>
			{children}
		</DialogPrimitive.Description>
	);
}

type DialogFooterProps = {
	children: ReactNode;
	className?: string;
};

export function DialogFooter({ children, className }: DialogFooterProps) {
	return (
		<div className={cn("flex", "justify-end", "pt-4 pb-1", className)}>
			{children}
		</div>
	);
}
