// biome-ignore-all lint/a11y/useFocusableInteractive: The ARIA table and row group do not require independent focus.
// biome-ignore-all lint/a11y/useSemanticElements: Grid layout requires div elements with explicit table roles.
import QuickAnalyze from "@analyses/components/Create/QuickAnalyze";
import { BoxGroup } from "@base/Box";
import Button from "@base/Button";
import ListEmpty from "@base/ListEmpty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import Pagination from "@base/Pagination";
import QueryError from "@base/QueryError";
import { nextSortDirection } from "@base/sorting";
import { useListSelection } from "@base/useListSelection";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import { useFetchLabels } from "@labels/queries";
import type { DateFilter } from "@samples/dateFilter";
import { useListSamples } from "@samples/queries";
import type {
	Sample,
	SampleMinimal,
	SampleSortField,
	SortDirection,
} from "@virtool/contracts";
import { xor } from "es-toolkit/array";
import { FlaskConical, SearchX } from "lucide-react";
import { type MouseEvent, useState } from "react";
import FilterBar from "./Filter/FilterBar";
import SampleItem from "./Item/SampleItem";
import SampleListHeader from "./SampleListHeader";
import SampleToolbar from "./SamplesToolbar";
import SampleTableHead from "./SampleTableHead";

type QuickAnalyzeTarget = {
	/** Whether the samples came from the list selection rather than a single sample */
	fromSelection: boolean;

	samples: SampleMinimal[];
};

/**
 * Builds a value that changes whenever the filters narrowing the list change.
 * The ids are sorted so that reordering a filter alone doesn't count as one.
 */
function getFilterKey(
	term: string,
	labels: number[],
	workflows: string[],
	users: number[],
	date: DateFilter | undefined,
): string {
	return JSON.stringify([
		term,
		[...labels].sort((a, b) => a - b),
		[...workflows].sort(),
		[...users].sort((a, b) => a - b),
		date ?? null,
	]);
}

type SamplesListProps = {
	dateFilter?: DateFilter;

	/** The direction the sorted column is ordered in */
	direction?: SortDirection;

	filterLabels?: number[];
	page?: number;
	setSearch?: (next: {
		createdAfter?: string;
		createdBefore?: string;
		direction?: SortDirection;
		labels?: number[];
		page?: number;
		sort?: SampleSortField;
		term?: string;
		users?: number[];
		workflows?: string[];
	}) => void;

	/** The column the list is sorted by, or undefined for newest first */
	sort?: SampleSortField;

	term?: string;
	users?: number[];
	workflows?: string[];
};

/**
 * A list of samples with filtering.
 */
export default function SamplesList({
	dateFilter,
	direction = "descending",
	filterLabels = [],
	page: urlPage = 1,
	setSearch = () => {},
	sort,
	term = "",
	users: filterUsers = [],
	workflows: filterWorkflows = [],
}: SamplesListProps) {
	const {
		data: samples,
		isPending: isPendingSamples,
		isError: isErrorSamples,
	} = useListSamples({
		createdAfter: dateFilter?.after,
		createdBefore: dateFilter?.before,
		direction,
		labels: filterLabels,
		page: urlPage,
		perPage: 25,
		sort,
		term,
		users: filterUsers,
		workflows: filterWorkflows,
	});
	// Labels are fetched here rather than passed in so the request goes out in
	// the same render as the samples request, instead of gating it.
	const {
		data: labels,
		isPending: isPendingLabels,
		isError: isErrorLabels,
	} = useFetchLabels();

	// The samples themselves are held, not just their ids: the selection outlives
	// the page they were checked on, and the bulk actions need their labels. It
	// survives pagination but resets when the filters change (via ``resetKey``),
	// otherwise samples would linger unseen and re-check themselves if the user
	// paged back to them.
	const filterKey = getFilterKey(
		term,
		filterLabels,
		filterWorkflows,
		filterUsers,
		dateFilter,
	);
	const selection = useListSelection<SampleMinimal>({
		getKey: (sample) => sample.id,
		resetKey: filterKey,
	});
	const [openQuickAnalyze, setOpenQuickAnalyze] = useState(false);
	const [quickAnalyzeTarget, setQuickAnalyzeTarget] =
		useState<QuickAnalyzeTarget>({ fromSelection: false, samples: [] });

	// Held separately from ``selected`` so a row's quick analyze can ignore the
	// checkbox selection, and so the samples outlive the dialog's exit animation.
	function openQuickAnalyzeFor(target: QuickAnalyzeTarget) {
		setQuickAnalyzeTarget(target);
		setOpenQuickAnalyze(true);
	}

	if ((isErrorSamples && !samples) || (isErrorLabels && !labels)) {
		return <QueryError noun="samples" />;
	}

	if (isPendingSamples || isPendingLabels) {
		return <LoadingPlaceholder />;
	}

	const { foundCount, items, page, pageCount } = samples;

	// An empty list means "nothing created yet" only when nothing is narrowing
	// it. Otherwise the samples exist and the filters are hiding them.
	const isFiltered =
		Boolean(term) ||
		Boolean(dateFilter) ||
		filterLabels.length > 0 ||
		filterWorkflows.length > 0 ||
		filterUsers.length > 0;

	function clearFilters() {
		setSearch({
			createdAfter: undefined,
			createdBefore: undefined,
			labels: [],
			page: 1,
			term: "",
			users: [],
			workflows: [],
		});
	}

	function handleChangeDate(next: DateFilter | undefined) {
		setSearch({
			createdAfter: next?.after,
			createdBefore: next?.before,
			page: 1,
		});
	}

	function handleSort(field: SampleSortField) {
		setSearch({
			direction: nextSortDirection(field, sort, direction),
			page: 1,
			sort: field,
		});
	}

	const itemsById = new Map(items.map((item) => [item.id, item]));

	// The bulk actions apply to the whole selection, including samples checked on
	// pages that are no longer fetched. Those still on this page are re-read from
	// the fetched page so a refetch doesn't leave the actions holding a stale copy.
	const selectedSamples = selection.selected.map(
		(sample) => itemsById.get(sample.id) ?? sample,
	);

	// A selected sample from an unfetched page won't be refreshed by invalidating
	// the list, so its labels are taken from the update response instead.
	function handleLabelsUpdated(updated: Sample[]) {
		const labelsById = new Map(
			updated.map((sample) => [sample.id, sample.labels]),
		);

		selection.setSelected((previous) =>
			previous.map((sample) => {
				const labels = labelsById.get(sample.id);
				return labels ? { ...sample, labels } : sample;
			}),
		);
	}

	function renderRow(item: SampleMinimal) {
		function handleSelect(event: MouseEvent<HTMLButtonElement>) {
			selection.select(item, {
				shiftKey: event.shiftKey,
				visibleItems: items,
			});
		}

		return (
			<SampleItem
				key={item.id}
				sample={item}
				checked={selection.isSelected(item)}
				handleSelect={handleSelect}
				onQuickAnalyze={() =>
					openQuickAnalyzeFor({ fromSelection: false, samples: [item] })
				}
			/>
		);
	}

	return (
		<>
			<QuickAnalyze
				fromSelection={quickAnalyzeTarget.fromSelection}
				open={openQuickAnalyze}
				setOpen={setOpenQuickAnalyze}
				samples={quickAnalyzeTarget.samples}
			/>
			<div className="container mx-auto">
				<ViewHeader title="Samples">
					<ViewHeaderTitle>Samples</ViewHeaderTitle>
				</ViewHeader>
				<SampleToolbar term={term} onChange={(term) => setSearch({ term })} />
				<FilterBar
					dateFilter={dateFilter}
					labels={labels}
					onChangeDate={handleChangeDate}
					onClearLabels={() => setSearch({ labels: [] })}
					onClearTerm={() => setSearch({ term: "" })}
					onClearUsers={() => setSearch({ users: [] })}
					onClearWorkflows={() => setSearch({ workflows: [] })}
					onToggleLabel={(labelId) =>
						setSearch({ labels: xor(filterLabels, [labelId]) })
					}
					onToggleUser={(userId) =>
						setSearch({ users: xor(filterUsers, [userId]) })
					}
					onToggleWorkflow={(workflow) =>
						setSearch({ workflows: xor(filterWorkflows, [workflow]) })
					}
					selectedLabels={filterLabels}
					selectedUsers={filterUsers}
					selectedWorkflows={filterWorkflows}
					term={term}
				/>
				{!items.length ? (
					<ListEmpty
						icon={isFiltered ? SearchX : FlaskConical}
						title={isFiltered ? "No matching samples" : "No samples"}
						description={
							isFiltered
								? "No samples match the current filters."
								: "No samples have been created yet."
						}
					>
						{isFiltered && (
							<Button onClick={clearFilters} size="small">
								Clear filters
							</Button>
						)}
					</ListEmpty>
				) : (
					<Pagination
						storedPage={page}
						currentPage={urlPage}
						pageCount={pageCount}
						onPageChange={(page) => setSearch({ page })}
					>
						<BoxGroup>
							<SampleListHeader
								found={foundCount}
								labels={labels}
								onLabelsUpdated={handleLabelsUpdated}
								onQuickAnalyze={() =>
									openQuickAnalyzeFor({
										fromSelection: true,
										samples: selectedSamples,
									})
								}
								selectedSamples={selectedSamples}
							/>
							<div
								aria-label="Samples list"
								className="[&_.sample-table-grid]:grid [&_.sample-table-grid]:grid-cols-[4rem_minmax(0,1fr)_16rem_12rem_10rem_4rem] xl:[&_.sample-table-grid]:grid-cols-[4rem_minmax(0,1fr)_8rem_12rem_16rem_12rem_10rem_4rem]"
								role="table"
							>
								<SampleTableHead
									checked={selection.getVisibleState(items)}
									direction={direction}
									onSelectAll={() => selection.toggleVisible(items)}
									onSort={handleSort}
									sort={sort}
								/>
								{items.map(renderRow)}
							</div>
						</BoxGroup>
					</Pagination>
				)}
			</div>
		</>
	);
}
