import { cn } from "@app/cn";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Toast as ToastPrimitives } from "radix-ui";
import type { ComponentProps, ReactElement } from "react";

export const ToastProvider = ToastPrimitives.Provider;

/**
 * The fixed region the toasts stack in — the bottom-right corner, above every
 * other layer, matching the upload overlay it shares the corner with.
 */
export function ToastViewport({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Viewport>) {
	return (
		<ToastPrimitives.Viewport
			className={cn(
				"fixed bottom-0 right-0 z-toast flex max-h-screen w-96 max-w-full flex-col-reverse gap-2 p-4 outline-none",
				className,
			)}
			{...props}
		/>
	);
}

const toastVariants = cva(
	[
		"group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-md border p-4 pr-8 shadow-xl ring-1 ring-black/5",
		"data-[state=open]:animate-slideLeftAndFade",
	],
	{
		variants: {
			variant: {
				default: "border-gray-700 bg-gray-800 text-gray-50",
				destructive: "border-red-600 bg-red-600 text-white",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

type ToastProps = ComponentProps<typeof ToastPrimitives.Root> &
	VariantProps<typeof toastVariants>;

/** A single toast, styled by its `variant`. */
export function Toast({ className, variant, ...props }: ToastProps) {
	return (
		<ToastPrimitives.Root
			className={cn(toastVariants({ variant }), className)}
			{...props}
		/>
	);
}

/** A labelled action button that sits inside a toast. */
export function ToastAction({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Action>) {
	return (
		<ToastPrimitives.Action
			className={cn(
				"inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-transparent px-3 text-sm font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 group-[.destructive]:border-white/40 group-[.destructive]:hover:bg-white/10",
				className,
			)}
			{...props}
		/>
	);
}

/** The corner button that dismisses a toast. */
export function ToastClose({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Close>) {
	return (
		<ToastPrimitives.Close
			className={cn(
				"absolute right-1.5 top-1.5 rounded-md p-1 text-white/70 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-400 group-hover:opacity-100",
				className,
			)}
			toast-close=""
			{...props}
		>
			<X className="size-4" />
		</ToastPrimitives.Close>
	);
}

/** The bold heading line of a toast. */
export function ToastTitle({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Title>) {
	return (
		<ToastPrimitives.Title
			className={cn("text-sm font-medium", className)}
			{...props}
		/>
	);
}

/** The supporting line under a toast's title. */
export function ToastDescription({
	className,
	...props
}: ComponentProps<typeof ToastPrimitives.Description>) {
	return (
		<ToastPrimitives.Description
			className={cn("text-sm font-medium opacity-90", className)}
			{...props}
		/>
	);
}

/** The props a {@link Toast} accepts. */
export type ToastRootProps = ToastProps;

/** A toast action element, passed through the toast queue. */
export type ToastActionElement = ReactElement<typeof ToastAction>;
