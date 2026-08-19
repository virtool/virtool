import { cn } from "@app/cn";
import { X } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { buttonVariants } from "./buttonVariants";

type ToastProviderProps = ComponentPropsWithoutRef<
	typeof ToastPrimitive.Provider
>;

/**
 * Provides the toast context. Toasts sit at the top of the screen, so they
 * swipe up to dismiss.
 */
export function ToastProvider({
	swipeDirection = "up",
	...props
}: ToastProviderProps) {
	return <ToastPrimitive.Provider swipeDirection={swipeDirection} {...props} />;
}

type ToastViewportProps = {
	className?: string;
};

/**
 * A fixed viewport that anchors toasts to the top-centre of the screen and
 * stacks them vertically. Dialogs put their actions in a footer and the nav
 * puts its controls in the top corners, so the top centre is the one band
 * that stays clear of both.
 */
export function ToastViewport({ className }: ToastViewportProps) {
	return (
		<ToastPrimitive.Viewport
			className={cn(
				"fixed top-0 inset-x-0 z-toast",
				"flex flex-col gap-2",
				"mx-auto my-0 p-6 w-full sm:max-w-md",
				"list-none outline-none pointer-events-none",
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
				"data-[state=open]:animate-slideDownAndFade",
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

type ToastDescriptionProps = {
	children: ReactNode;
	className?: string;
};

/** A styled toast body for secondary detail beneath the title. */
export function ToastDescription({
	children,
	className,
}: ToastDescriptionProps) {
	return (
		<ToastPrimitive.Description
			className={cn("text-gray-600 text-sm", className)}
		>
			{children}
		</ToastPrimitive.Description>
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

type ToastCloseProps = {
	className?: string;
};

/** A styled dismiss button rendered in the corner of a toast. */
export function ToastClose({ className }: ToastCloseProps) {
	return (
		<ToastPrimitive.Close
			aria-label="Close"
			className={cn(
				"text-gray-500 hover:text-gray-600 cursor-pointer",
				className,
			)}
		>
			<X size={16} />
		</ToastPrimitive.Close>
	);
}
