import { cn } from "@app/cn";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

type InputErrorProps = {
	children: ReactNode;
	className?: string;

	/** Links the message to its input via `aria-describedby`. */
	id?: string;
};

/**
 * A validation error message for a form control.
 *
 * Rendered as an assertive live region (`role="alert"`) so a screen reader
 * announces the message the moment it appears on a failed submit, and paired
 * with a non-color icon so the error never relies on the red text alone.
 */
function InputError({ children, className, id }: InputErrorProps) {
	return (
		<p
			id={id}
			role="alert"
			className={cn(
				"flex items-center justify-end gap-1 text-red-600 text-sm font-medium mt-1 -mb-2.5 min-h-5 text-right",
				className,
			)}
		>
			{children ? (
				<CircleAlert aria-hidden className="shrink-0" size={14} />
			) : null}
			{children}
		</p>
	);
}

InputError.displayName = "InputError";

export default InputError;
