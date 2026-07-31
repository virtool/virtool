import { useAnalysisSearch } from "@analyses/components/AnalysisSearchContext";
import NuvsDetail from "@analyses/components/Nuvs/NuvsDetail";
import NuvsValues from "@analyses/components/Nuvs/NuvsValues";
import { useKeyNavigation } from "@analyses/components/Viewer/hooks";
import { useActiveHit, useSortAndFilterNuVsHits } from "@analyses/hooks";
import type { FormattedNuvsAnalysis, FormattedNuvsHit } from "@analyses/types";
import { cn } from "@app/cn";
import Badge from "@base/Badge";
import Box from "@base/Box";
import Key from "@base/Key";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

/**
 * The height of a row, in pixels.
 *
 * The virtualizer positions rows by this figure, so a row that renders any
 * other height detaches the list from its own scroll geometry. One constant
 * feeds both the estimate and the row itself.
 */
const ROW_HEIGHT = 75;

type NuvsListItemProps = {
	activeHit?: string;
	hit: FormattedNuvsHit;
	setActiveHit: (id: string) => void;
};

/** A condensed contig, as it appears in the list beside the detail view. */
function NuvsListItem({ activeHit, hit, setActiveHit }: NuvsListItemProps) {
	const { annotatedOrfCount, e, id, index, sequence } = hit;

	const isActive = activeHit !== undefined && Number(activeHit) === id;

	return (
		<Box
			className={cn(
				{ "bg-slate-100": isActive },
				"border-none",
				"h-full",
				"rounded-none",
				"m-0",
			)}
			onClick={() => setActiveHit(String(id))}
		>
			<div className="flex items-center justify-between">
				<span className="font-medium">Sequence {index}</span>
				<Badge>{sequence.length}</Badge>
			</div>

			<NuvsValues e={e} orfCount={annotatedOrfCount} />
		</Box>
	);
}

type NuVsListProps = {
	/** Complete Nuvs analysis details */
	detail: FormattedNuvsAnalysis;
};

/**
 * Displays a list of Nuvs hits with a detailed view
 */
export default function NuvsList({ detail }: NuVsListProps) {
	const sortedHits = useSortAndFilterNuVsHits(detail);
	const { search, setSearch } = useAnalysisSearch();

	const hit = useActiveHit(sortedHits);
	const activeHit = hit ? String(hit.id) : undefined;

	let nextId: string | undefined;
	let nextIndex: number | undefined;
	let previousId: string | undefined;
	let previousIndex: number | undefined;

	if (activeHit) {
		const windowIndex = sortedHits.findIndex(
			(hit) => hit.id === Number(activeHit),
		);

		if (windowIndex > 0) {
			previousIndex = windowIndex - 1;
			const previousHit = sortedHits[previousIndex];
			if (previousHit) {
				previousId = String(previousHit.id);
			}
		}

		if (windowIndex < sortedHits.length - 1) {
			nextIndex = windowIndex + 1;
			const nextHit = sortedHits[nextIndex];
			if (nextHit) {
				nextId = String(nextHit.id);
			}
		}
	}

	const shown = sortedHits.length;
	const total = detail.results.hits.length;
	const width = 230;

	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: shown,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 5,
	});

	useKeyNavigation(
		virtualizer,
		nextId,
		nextIndex,
		previousId,
		previousIndex,
		(id) => setSearch({ hit: id }),
	);

	const hitComponents = sortedHits.map((hit) => (
		<NuvsListItem
			key={hit.id}
			activeHit={activeHit}
			hit={hit}
			setActiveHit={(id) => setSearch({ hit: id })}
		/>
	));

	return (
		<div className="flex gap-4">
			<div>
				<div
					className="border-1 border-gray-300 overflow-hidden relative rounded"
					style={{ width: `${width}px` }}
				>
					<div className="bg-gray-300 py-3 px-4 shadow-sm z-10">
						Showing {shown} of {total}
					</div>
					<div
						ref={parentRef}
						className="h-[500px] overflow-auto"
						style={{ width }}
					>
						<div
							className="relative w-full"
							style={{ height: virtualizer.getTotalSize() }}
						>
							{virtualizer.getVirtualItems().map((virtualRow) => (
								<div
									key={virtualRow.key}
									className="absolute left-0 top-0 w-full"
									style={{
										height: virtualRow.size,
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									{hitComponents[virtualRow.index]}
								</div>
							))}
						</div>
					</div>
				</div>
				<div className="p-4 text-sm text-center">
					Use <Key>w</Key> and <Key>s</Key> to move
				</div>
			</div>
			<NuvsDetail
				analysisId={detail.id}
				filterORFs={!search.showUnhitOrfs}
				matches={sortedHits}
				maxSequenceLength={detail.results.maxSequenceLength}
			/>
		</div>
	);
}
