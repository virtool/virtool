import type { ButtonHTMLAttributes } from "react";

const BASE =
	"inline-flex min-h-7 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3 [&_svg]:shrink-0";

const VARIANTS = {
	danger:
		"border-red-200 bg-red-50 text-red-800 hover:bg-red-100 active:bg-red-200",
	primary:
		"border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900",
	secondary:
		"border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 aria-pressed:bg-slate-300 aria-pressed:hover:bg-slate-300",
} as const;

type ButtonVariant = keyof typeof VARIANTS;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
};

export function buttonClassName(
	variant: ButtonVariant = "secondary",
	className?: string,
): string {
	return [BASE, VARIANTS[variant], className].filter(Boolean).join(" ");
}

export function Button({
	className,
	type = "button",
	variant = "secondary",
	...props
}: ButtonProps) {
	return (
		<button
			className={buttonClassName(variant, className)}
			type={type}
			{...props}
		/>
	);
}
