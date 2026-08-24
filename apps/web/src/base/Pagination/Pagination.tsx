import { cn } from "@app/cn";
import { range } from "es-toolkit/math";
import { type ReactNode, useEffect } from "react";
import PaginationContent from "./PaginationContent";
import PaginationLink from "./PaginationLink";
import PaginationNext from "./PaginationNext";
import PaginationPrevious from "./PaginationPrevious";
import PaginationRoot from "./PaginationRoot";

function getPageRange(
	pageCount: number,
	storedPage: number,
	leftButtons = 1,
	rightButtons = 2,
) {
	const totalButtons = leftButtons + rightButtons;
	let maxVal = Math.min(pageCount, storedPage + rightButtons);
	const minVal = Math.max(1, maxVal - totalButtons);
	maxVal = Math.min(pageCount, minVal + totalButtons);

	return range(minVal, maxVal + 1);
}

type PaginationProps = {
	children?: ReactNode;
	storedPage: number;
	currentPage: number;
	pageCount: number;
	onPageChange?: (page: number) => void;
	/** Extra classes for the element wrapping the rendered rows */
	rowsClassName?: string;
};

export default function Pagination({
	children,
	currentPage,
	onPageChange = () => {},
	pageCount,
	rowsClassName,
	storedPage,
}: PaginationProps) {
	useEffect(() => {
		if (currentPage > pageCount) {
			onPageChange(pageCount);
		}
	}, [currentPage, onPageChange, pageCount]);

	const pageButtons = getPageRange(pageCount, storedPage).map((pageNumber) => (
		<PaginationLink
			key={pageNumber}
			page={pageNumber}
			active={storedPage !== pageNumber}
			disabled={storedPage === pageNumber}
			onPageChange={onPageChange}
		>
			{pageNumber}
		</PaginationLink>
	));

	return (
		<div>
			<div className={cn("pb-1.5", rowsClassName)}>{children}</div>
			{pageCount > 1 && (
				<PaginationRoot>
					<PaginationContent>
						<PaginationPrevious
							page={currentPage - 1}
							disabled={currentPage === 1}
							active={currentPage !== 1}
							onPageChange={onPageChange}
						/>
						{pageButtons}
						<PaginationNext
							page={currentPage + 1}
							disabled={currentPage === pageCount}
							onPageChange={onPageChange}
						/>
					</PaginationContent>
				</PaginationRoot>
			)}
		</div>
	);
}
