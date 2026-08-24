import { cn } from "@app/cn";
import { IconButton, type IconButtonProps } from "@base/Icon";

export default function InputIconButton({
	className,
	size = 16,
	...props
}: IconButtonProps) {
	return (
		<IconButton
			className={cn(
				"absolute mx-1.5 flex items-center justify-center",
				className,
			)}
			size={size}
			{...props}
		/>
	);
}
