import { cn } from "@app/cn";
import Box from "@base/Box";
import CompactScrollList from "@base/CompactScrollList";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@base/Empty";
import { InputError } from "@base/Input";
import Link from "@base/Link";
import useListboxNavigation from "@base/useListboxNavigation";
import type { InfiniteData } from "@tanstack/react-query";
import type {
	FetchNextPageOptions,
	InfiniteQueryObserverResult,
} from "@tanstack/react-query/";
import { useValidateFiles } from "@uploads/hooks";
import type { Upload, UploadSearchResult } from "@virtool/contracts";
import { Files } from "lucide-react";
import { SubtractionFileItem } from "./SubtractionFileItem";

type SubtractionFileSelectorProps = {
	/** The id of the element that labels the file list */
	"aria-labelledby"?: string;

	/** The subtraction uploads */
	files: InfiniteData<UploadSearchResult>;

	/** The number of subtraction uploads */
	foundCount: number;

	/** The selected file id */
	selected: number[];

	/** A callback function to handle file selection */
	onClick: (selected: number[]) => void;

	/** Errors occurred on sample creation */
	error: string;

	/** Fetches the next page of data */
	fetchNextPage: (
		options?: FetchNextPageOptions,
	) => Promise<InfiniteQueryObserverResult>;

	/** Whether the data is fetched */
	isPending: boolean;

	/** Whether the next page is being fetched */
	isFetchingNextPage: boolean;
};

/**
 * A list of subtraction uploads
 */
export function SubtractionFileSelector({
	"aria-labelledby": ariaLabelledby,
	files,
	foundCount,
	selected,
	onClick,
	error,
	fetchNextPage,
	isPending,
	isFetchingNextPage,
}: SubtractionFileSelectorProps) {
	useValidateFiles("subtraction", selected, onClick);

	const items = files.pages.flatMap((page) => page.items);

	const { listboxProps, activeOptionId, getOptionId } = useListboxNavigation(
		items,
		(item) => item.id,
		(item) => onClick([item.id]),
	);

	// CompactScrollList types its rows as `unknown`; the items are uploads.
	function renderRow(item: unknown) {
		const upload = item as Upload;
		const optionId = getOptionId(upload.id);

		return (
			<SubtractionFileItem
				key={upload.id}
				{...upload}
				active={selected?.includes(upload.id)}
				highlighted={activeOptionId === optionId}
				optionId={optionId}
				onClick={onClick}
				error={error}
			/>
		);
	}

	return foundCount === 0 ? (
		<Box>
			<Empty className="py-12">
				<EmptyMedia className="text-gray-400">
					<Files size={40} strokeWidth={1.5} />
				</EmptyMedia>
				<EmptyTitle>No files found</EmptyTitle>
				<EmptyDescription>
					Upload subtraction files to get started.
				</EmptyDescription>
				<EmptyContent>
					<Link to="/subtractions/files">Upload some</Link>
				</EmptyContent>
			</Empty>
		</Box>
	) : (
		<>
			<CompactScrollList
				{...listboxProps}
				aria-labelledby={ariaLabelledby}
				className={cn(
					"max-h-96",
					"outline-none",
					"focus-visible:ring-2",
					"focus-visible:ring-inset",
					"focus-visible:ring-blue-500/30",
				)}
				fetchNextPage={fetchNextPage}
				isFetchingNextPage={isFetchingNextPage}
				isPending={isPending}
				items={items}
				renderRow={renderRow}
			/>
			<InputError className="mb-1">{error}</InputError>
		</>
	);
}
