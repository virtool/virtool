import { cn } from "@app/cn";
import Icon, { type IconProps } from "@base/Icon";
import type { ElementType, ReactNode } from "react";

export type InputIconProps = Partial<IconProps> & {
	as?: ElementType;
	children?: ReactNode;
};

export default function InputIcon({
	as: Component = "div",
	children,
	className,
	icon,
	...props
}: InputIconProps) {
	return (
		<Component
			className={cn(
				"absolute top-0 bottom-0 flex items-center justify-center mx-2",
				className,
			)}
		>
			{icon && <Icon icon={icon} {...props} />}
			{children}
		</Component>
	);
}
