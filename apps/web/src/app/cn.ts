import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names, resolving conflicting Tailwind utilities.
 *
 * Keep this separate from general utilities so their consumers do not load
 * tailwind-merge just to use a lightweight helper.
 */
export function cn(...args: ClassValue[]): string {
	return twMerge(clsx(args));
}
