import { cn } from "@app/cn";
import type { ComponentProps, Ref } from "react";

type PaginationContentProps = ComponentProps<"ul"> & {
	ref?: Ref<HTMLUListElement>;
};

export default function PaginationContent({
	className,
	ref,
	...props
}: PaginationContentProps) {
	return (
		<ul
			ref={ref}
			className={cn("flex flex-row items-center gap-1", className)}
			{...props}
		/>
	);
}
