import { cn } from "@app/cn";
import Alert from "@base/Alert";
import Box from "@base/Box";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import Button from "@base/Button";
import CompactScrollList from "@base/CompactScrollList";
import Dropdown from "@base/Dropdown";
import DropdownButton from "@base/DropdownButton";
import DropdownMenuContent from "@base/DropdownMenuContent";
import DropdownMenuItem from "@base/DropdownMenuItem";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@base/Empty";
import Icon from "@base/Icon";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputSearch from "@base/InputSearch";
import Link from "@base/Link";
import Toolbar from "@base/Toolbar";
import type {
	FetchNextPageOptions,
	InfiniteData,
	InfiniteQueryObserverResult,
} from "@tanstack/react-query/";
import { useValidateFiles } from "@uploads/hooks";
import { buildReadRows, detectMate, type ReadRow } from "@uploads/pairing";
import type { Upload, UploadSearchResult } from "@virtool/contracts";
import { ChevronDown, Files, TriangleAlert, Undo } from "lucide-react";
import { useCallback, useState } from "react";
import ReadPairBadge from "./ReadPairBadge";
import ReadSelectorRow from "./ReadSelectorRow";
import ReadSelectorSlots from "./ReadSelectorSlots";

/** How a click mutates the selection. */
type SelectorMode = "auto" | "manual";

/** The selectable modes, with a label and an explanation for the dropdown. */
const selectorModes: {
	value: SelectorMode;
	label: string;
	description: string;
}[] = [
	{
		value: "auto",
		label: "Auto-pair",
		description:
			"Detected mate pairs collapse into a single row. Click a row to select that pair or file.",
	},
	{
		value: "manual",
		label: "Manual",
		description:
			"Every file is listed on its own. Click to pick up to two files, then swap their order if needed.",
	},
];

type ReadSelectorProps = {
	/** Samples uploads on current page */
	data: InfiniteData<UploadSearchResult>;
	/** Whether the next page is being fetched */
	isFetchingNextPage: boolean;
	/** Fetches the next page of data */
	fetchNextPage: (
		options?: FetchNextPageOptions,
	) => Promise<InfiniteQueryObserverResult>;
	/** Whether the data is fetched */
	isPending: boolean;
	/** A callback function to handle file selection */
	onSelect: (selected: number[]) => void;
	/** Errors occurred on sample creation */
	error?: string;
	/** The selected uploads, in [LEFT, RIGHT] order */
	selected: number[];
};

/**
 * Returns true when a selected file sits in the wrong slot given its detected
 * mate side: an R2 file in LEFT or an R1 file in RIGHT. Files with no detected
 * side never mismatch.
 */
function isMisplaced(file: Upload | undefined, slotIndex: number): boolean {
	const side = file && detectMate(file.name)?.side;

	if (side === undefined) {
		return false;
	}

	return side === 1 ? slotIndex !== 0 : slotIndex !== 1;
}

/**
 * Selects the one or two read files for a new sample. Two modes edit the same
 * `selected` array: Auto-pair (default) collapses detected mate pairs and uses
 * radio-style replace; Manual lists every file flat and toggles up to two.
 * Switching modes never migrates data — it only changes how a click mutates the
 * selection.
 */
export default function ReadSelector({
	data,
	isFetchingNextPage,
	fetchNextPage,
	isPending,
	onSelect,
	error,
	selected,
}: ReadSelectorProps) {
	const [term, setTerm] = useState("");
	const [mode, setMode] = useState<SelectorMode>("auto");
	const [wasCleared, setWasCleared] = useState(false);

	const handleCleared = useCallback(() => setWasCleared(true), []);

	useValidateFiles("reads", selected, onSelect, handleCleared);

	const totalCount = data.pages[0]?.totalCount;
	const items = data.pages.flatMap((page) => page.items);

	const loweredFilter = term.toLowerCase();
	const files = items.filter(
		(file) => !term || file.name.toLowerCase().includes(loweredFilter),
	);

	const rows: ReadRow[] =
		mode === "auto"
			? buildReadRows(files)
			: files.map((file) => ({ kind: "single", file }));

	// Auto-pair: clicking a row replaces the whole selection with that row's
	// file(s); clicking the already-selected row clears it.
	function replaceSingle(id: number) {
		if (selected.length === 1 && selected[0] === id) {
			onSelect([]);
			return;
		}

		onSelect([id]);
	}

	function replacePair(leftId: number, rightId: number) {
		if (selected.includes(leftId) && selected.includes(rightId)) {
			onSelect([]);
			return;
		}

		onSelect([leftId, rightId]);
	}

	// Manual: toggle a file in or out of the selection, capped at two. A third
	// click is a quiet no-op.
	function toggleFile(id: number) {
		if (selected.includes(id)) {
			onSelect(selected.filter((selectedId) => selectedId !== id));
			return;
		}

		if (selected.length >= 2) {
			return;
		}

		onSelect([...selected, id]);
	}

	function swap() {
		onSelect([...selected].reverse());
	}

	function reset() {
		setTerm("");
		setWasCleared(false);
		onSelect([]);
	}

	const onSelectSingle = mode === "auto" ? replaceSingle : toggleFile;

	function renderRow(item: unknown) {
		const row = item as ReadRow;
		const key =
			row.kind === "pair" ? `pair:${row.key}` : `single:${row.file.id}`;

		return (
			<ReadSelectorRow
				key={key}
				row={row}
				selected={selected}
				onSelectSingle={onSelectSingle}
				onSelectPair={replacePair}
			/>
		);
	}

	const noneFound = totalCount === 0 && (
		<BoxGroup>
			<BoxGroupSection>
				<Empty className="py-12">
					<EmptyMedia className="text-gray-400">
						<Files size={40} strokeWidth={1.5} />
					</EmptyMedia>
					<EmptyTitle>No files found</EmptyTitle>
					<EmptyDescription>
						Upload read files to run a sample.
					</EmptyDescription>
					<EmptyContent>
						<Link to="/samples/files">Upload some</Link>
					</EmptyContent>
				</Empty>
			</BoxGroupSection>
		</BoxGroup>
	);

	const misplaced =
		mode === "manual" &&
		selected.some((id, index) =>
			isMisplaced(
				items.find((file) => file.id === id),
				index,
			),
		);

	return (
		<InputGroup>
			<div className="flex items-center justify-between">
				<InputLabel htmlFor="read-files-search">Read files</InputLabel>
				<ReadPairBadge count={selected.length} />
			</div>

			{wasCleared && (
				<Alert color="orange" icon={TriangleAlert} level>
					<span>
						A previously selected read file is no longer available and was
						removed from your selection.
					</span>
				</Alert>
			)}

			{misplaced && (
				<Alert color="orange" icon={TriangleAlert} level>
					<span>
						A selected file looks like it belongs in the other slot based on its
						name. Use the swap control if the LEFT / RIGHT order is wrong.
					</span>
				</Alert>
			)}

			<ReadSelectorSlots
				selected={selected}
				items={items}
				onSwap={swap}
				showSwap={mode === "manual"}
			/>

			<Box className={cn(error && "border-red-600")}>
				<Toolbar>
					<div className="flex-grow">
						<InputSearch
							id="read-files-search"
							aria-label="Search read files"
							aria-describedby={error ? "read-files-error" : undefined}
							placeholder="Filename"
							value={term}
							onChange={(e) => setTerm(e.target.value)}
						/>
					</div>
					<Button className="inline-flex gap-2" type="button" onClick={reset}>
						<Icon icon={Undo} /> Reset
					</Button>
					<Dropdown>
						<DropdownButton className="flex items-center gap-1.5">
							{selectorModes.find((m) => m.value === mode)?.label}
							<ChevronDown size={16} />
						</DropdownButton>
						<DropdownMenuContent className="max-w-72">
							{selectorModes.map((selectorMode) => (
								<DropdownMenuItem
									key={selectorMode.value}
									onSelect={() => setMode(selectorMode.value)}
									className="flex flex-col items-start"
								>
									<span className="font-medium">{selectorMode.label}</span>
									<span className="text-xs text-gray-500">
										{selectorMode.description}
									</span>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</Dropdown>
				</Toolbar>
				{noneFound || (
					<>
						<CompactScrollList
							className="border border-gray-300 rounded h-54"
							fetchNextPage={fetchNextPage}
							isFetchingNextPage={isFetchingNextPage}
							isPending={isPending}
							items={rows}
							renderRow={renderRow}
						/>

						<InputError id="read-files-error" className="mb-2.5">
							{error}
						</InputError>
					</>
				)}
			</Box>
		</InputGroup>
	);
}
