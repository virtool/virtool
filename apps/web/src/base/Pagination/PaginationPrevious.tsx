import { cn } from "@app/cn";
import PaginationLink from "./PaginationLink";

type PaginationPreviousProps = {
	active?: boolean;
	className?: string;
	disabled?: boolean;
	onPageChange: (page: number) => void;
	page: number;
};

export default function PaginationPrevious({
	active,
	className,
	disabled,
	onPageChange,
	page,
}: PaginationPreviousProps) {
	return (
		<PaginationLink
			ariaLabel="Go to previous page"
			className={cn("gap-1 pl-2.5", className)}
			active={active}
			disabled={disabled}
			onPageChange={onPageChange}
			page={page}
		>
			Previous
		</PaginationLink>
	);
}
