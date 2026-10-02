import { cn } from "@app/cn";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useFieldContext, useRegisterFieldPart } from "./FieldContext";

/** Props for a `FieldError`. Pass either a message as children or react-hook-form errors. */
export type FieldErrorProps = {
	children?: ReactNode;
	className?: string;

	/** Errors to show, such as react-hook-form `FieldError` objects. Duplicate messages show once. */
	errors?: Array<{ message?: string } | undefined>;
};

/**
 * A validation error for the control in the surrounding `Field`.
 *
 * Always renders, reserving its height so the layout does not shift when an
 * error appears. It is an assertive live region so a screen reader announces
 * the message the moment it appears, and it shows a non-color icon so the
 * error never relies on the red text alone. A message marks the control
 * invalid and links it through `aria-describedby`.
 */
export default function FieldError({
	children,
	className,
	errors,
}: FieldErrorProps) {
	const field = useFieldContext();

	const messages = [
		...new Set(
			(errors ?? [])
				.map((error) => error?.message)
				.filter((message): message is string => Boolean(message)),
		),
	];

	const content =
		children ??
		(messages.length > 1 ? (
			<ul className="list-disc list-inside">
				{messages.map((message) => (
					<li key={message}>{message}</li>
				))}
			</ul>
		) : (
			messages[0]
		));

	const hasContent = Boolean(content);

	useRegisterFieldPart(field?.setInvalid, hasContent);

	return (
		<div
			className={cn(
				"flex items-center justify-end gap-1 text-red-600 text-sm font-medium mt-1 -mb-2.5 min-h-5 text-right",
				className,
			)}
			data-slot="field-error"
			id={field?.errorId}
			role="alert"
		>
			{hasContent ? (
				<CircleAlert aria-hidden className="shrink-0" size={14} />
			) : null}
			{content}
		</div>
	);
}
