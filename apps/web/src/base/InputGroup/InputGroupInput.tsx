import { cn } from "@app/cn";
import Input, { type InputProps } from "@base/Input";

/** The text input inside an `InputGroup`. Accepts every `Input` prop. */
export default function InputGroupInput({ className, ...props }: InputProps) {
	return (
		<Input
			className={cn(
				"flex-1 h-full rounded-none border-0 bg-transparent focus-visible:ring-0 aria-invalid:focus-visible:ring-0",
				className,
			)}
			data-slot="input-group-control"
			{...props}
		/>
	);
}
