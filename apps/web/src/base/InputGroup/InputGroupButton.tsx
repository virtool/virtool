import { cn } from "@app/cn";
import { IconButton, type IconButtonProps } from "@base/Icon";

/** An icon button inside an `InputGroupAddon`, such as a show-password toggle. */
export default function InputGroupButton({
	className,
	size = 16,
	...props
}: IconButtonProps) {
	return (
		<IconButton
			className={cn("flex items-center justify-center", className)}
			size={size}
			{...props}
		/>
	);
}
