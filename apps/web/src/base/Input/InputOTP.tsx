import { cn } from "@app/cn";
import { useFieldControl } from "@base/Field";
import { OTPInput, OTPInputContext, type OTPInputProps } from "input-otp";
import { type ComponentProps, useContext } from "react";

/** Props for the one-time code input. */
type InputOTPProps = Omit<
	ComponentProps<"input">,
	"children" | "onChange" | "value"
> & {
	/** The number of characters in the code. */
	length: number;
	/** The current code. */
	value?: string;
	onChange: (value: string) => void;
	onComplete?: OTPInputProps["onComplete"];
};

/**
 * A full-width one-time code input that shows one box for each character. Inside a
 * `Field`, it takes its `id` and ARIA connections from the field.
 */
export default function InputOTP({
	className,
	length,
	...props
}: InputOTPProps) {
	const fieldProps = useFieldControl(props);

	return (
		<OTPInput
			containerClassName={cn(
				"group flex w-full items-center has-disabled:opacity-50",
				className,
			)}
			className="disabled:cursor-not-allowed"
			data-slot="input-otp"
			maxLength={length}
			spellCheck={false}
			{...props}
			{...fieldProps}
		>
			<div className="flex w-full items-center">
				{Array.from({ length }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
					<InputOTPSlot key={index} index={index} />
				))}
			</div>
		</OTPInput>
	);
}

function InputOTPSlot({ index }: { index: number }) {
	const { slots } = useContext(OTPInputContext);
	const slot = slots[index];

	return (
		<div
			data-active={slot?.isActive}
			className={cn(
				"relative flex h-10 flex-1 items-center justify-center -ml-px border border-gray-300 bg-white font-mono text-lg transition-[color,box-shadow]",
				"first:ml-0 first:rounded-l last:rounded-r",
				"data-[active=true]:z-10 data-[active=true]:border-blue-500 data-[active=true]:ring-2 data-[active=true]:ring-blue-500/50",
				"group-has-aria-invalid:border-red-500 group-has-aria-invalid:data-[active=true]:ring-red-500/50",
			)}
		>
			{slot?.char}
			{slot?.hasFakeCaret && (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="h-5 w-px animate-caretBlink bg-gray-900" />
				</div>
			)}
		</div>
	);
}
