import { cn } from "@app/cn";
import { Toast as ToastPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { buttonVariants } from "./buttonVariants";

export const ToastProvider = ToastPrimitive.Provider;

type ToastViewportProps = {
	className?: string;
};

/**
 * A fixed viewport that anchors toasts to the bottom-right of the screen and
 * stacks them vertically.
 */
export function ToastViewport({ className }: ToastViewportProps) {
	return (
		<ToastPrimitive.Viewport
			className={cn(
				"fixed bottom-0 right-0 z-toast",
				"flex flex-col gap-2",
				"m-0 p-6 w-full sm:max-w-md",
				"list-none outline-none",
				className,
			)}
		/>
	);
}

type ToastProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Root>;

/**
 * A styled toast container that slides in and holds a title and optional
 * action.
 */
export function Toast({ className, ...props }: ToastProps) {
	return (
		<ToastPrimitive.Root
			className={cn(
				"data-[state=open]:animate-slideUpAndFade",
				"bg-white border border-gray-200 rounded-md shadow-lg",
				"flex items-center justify-between gap-4",
				"p-4 pointer-events-auto",
				className,
			)}
			{...props}
		/>
	);
}

type ToastTitleProps = {
	children: ReactNode;
	className?: string;
};

/** A styled toast heading. */
export function ToastTitle({ children, className }: ToastTitleProps) {
	return (
		<ToastPrimitive.Title
			className={cn("font-medium text-gray-800", className)}
		>
			{children}
		</ToastPrimitive.Title>
	);
}

type ToastActionProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Action>;

/**
 * A styled action button rendered inside a toast. Radix requires `altText`
 * describing the action for assistive technology.
 */
export function ToastAction({ className, ...props }: ToastActionProps) {
	return (
		<ToastPrimitive.Action
			className={cn(
				buttonVariants({ color: "blue", size: "small" }),
				className,
			)}
			{...props}
		/>
	);
}
