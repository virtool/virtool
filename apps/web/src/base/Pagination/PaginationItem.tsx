import { cn } from "@app/cn";
import type { ComponentProps, Ref } from "react";

type PaginationItemProps = ComponentProps<"li"> & {
	ref?: Ref<HTMLLIElement>;
};

export default function PaginationItem({
	className,
	ref,
	...props
}: PaginationItemProps) {
	return <li ref={ref} className={cn("m-1.5", className)} {...props} />;
}
