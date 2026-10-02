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
 * A one-time code input that shows one box for each character, split into two
 * groups. It fills the width of its container. Inside a `Field`, it takes its `id` and ARIA connections from the
 * field.
 */
export default function InputOTP({
	className,
	length,
	...props
}: InputOTPProps) {
	const fieldProps = useFieldControl(props);
	const split = Math.ceil(length / 2);

	return (
		<OTPInput
			containerClassName={cn(
				"group flex w-full items-center gap-2 has-disabled:opacity-50",
				className,
			)}
			className="disabled:cursor-not-allowed"
			data-slot="input-otp"
			maxLength={length}
			spellCheck={false}
			{...props}
			{...fieldProps}
		>
			<InputOTPGroup start={0} end={split} />
			<div aria-hidden className="h-0.5 w-3 rounded-full bg-gray-400" />
			<InputOTPGroup start={split} end={length} />
		</OTPInput>
	);
}

function InputOTPGroup({ start, end }: { start: number; end: number }) {
	return (
		<div className="flex flex-1 items-center gap-2">
			{Array.from({ length: end - start }, (_, offset) => start + offset).map(
				(index) => (
					<InputOTPSlot key={index} index={index} />
				),
			)}
		</div>
	);
}

function InputOTPSlot({ index }: { index: number }) {
	const { slots } = useContext(OTPInputContext);
	const slot = slots[index];

	return (
		<div
			data-active={slot?.isActive}
			className={cn(
				"relative flex h-11 min-w-0 flex-1 items-center justify-center rounded border border-gray-300 bg-white font-mono text-xl transition-[color,box-shadow]",
				"data-[active=true]:border-blue-500 data-[active=true]:ring-2 data-[active=true]:ring-blue-500/50",
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
