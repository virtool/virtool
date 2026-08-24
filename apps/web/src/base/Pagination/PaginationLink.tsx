import { cn } from "@app/cn";
import type { ReactNode } from "react";
import PaginationItem from "./PaginationItem";

type PaginationLinkProps = {
	active?: boolean;
	ariaLabel?: string;
	children?: ReactNode;
	className?: string;
	disabled?: boolean;
	onPageChange: (page: number) => void;
	page: number;
};

export default function PaginationLink({
	active,
	ariaLabel,
	children,
	className,
	disabled,
	onPageChange,
	page,
}: PaginationLinkProps) {
	return (
		<PaginationItem>
			<button
				aria-current={disabled ? "page" : undefined}
				aria-label={ariaLabel}
				className={cn(
					"text-lg",
					"text-blue-500",
					{
						"text-blue-900": !active,
						"pointer-events-none": disabled,
					},
					className,
				)}
				disabled={disabled}
				onClick={() => onPageChange(page)}
				type="button"
			>
				{children}
			</button>
		</PaginationItem>
	);
}
