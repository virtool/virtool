import { BoxGroup } from "@base/Box";
import { ContainerNarrow } from "@base/Container";
import ListEmpty from "@base/ListEmpty";
import Pagination from "@base/Pagination";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import type { JobState } from "@virtool/contracts";
import { Cog, SearchX } from "lucide-react";
import { useSuspenseJobs } from "../queries";
import { JobFilters } from "./Filters/JobFilters";
import JobItem from "./JobItem";

const initialState: JobState[] = ["pending", "running"];

type JobsListProps = {
	page?: number;
	setSearch?: (next: { page?: number; state?: JobState[] }) => void;
	states?: JobState[];
};

export default function JobsList({
	page = 1,
	setSearch = () => {},
	states = initialState,
}: JobsListProps) {
	const { data } = useSuspenseJobs(page, 25, states);

	const {
		items,
		page: storedPage,
		pageCount,
		counts,
		foundCount,
		totalCount,
	} = data;

	const isEmpty = totalCount === 0 || foundCount === 0;
	const isFiltered = totalCount > 0 && foundCount === 0;

	return (
		<>
			<ViewHeader title="Jobs">
				<ViewHeaderTitle>Jobs</ViewHeaderTitle>
			</ViewHeader>
			<div className="flex gap-4">
				<ContainerNarrow>
					{isEmpty ? (
						<ListEmpty
							icon={isFiltered ? SearchX : Cog}
							title="No jobs found"
							description={
								isFiltered
									? "No jobs match your filters."
									: "No jobs have been run yet."
							}
						/>
					) : (
						<Pagination
							storedPage={storedPage}
							currentPage={page}
							pageCount={pageCount}
							onPageChange={(page) => setSearch({ page })}
						>
							<BoxGroup as="ul">
								{items.map((item) => (
									<JobItem key={item.id} as="li" {...item} />
								))}
							</BoxGroup>
						</Pagination>
					)}
				</ContainerNarrow>
				<JobFilters
					counts={counts}
					setStates={(state) => setSearch({ state })}
					states={states}
				/>
			</div>
		</>
	);
}
