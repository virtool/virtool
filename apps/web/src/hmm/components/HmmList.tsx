import { BoxGroup } from "@base/Box";
import ListEmpty from "@base/ListEmpty";
import Pagination from "@base/Pagination";
import SearchToolbar from "@base/SearchToolbar";
import { ViewHeader, ViewHeaderTitle, ViewHeaderTitleBadge } from "@base/View";
import { Boxes, SearchX } from "lucide-react";
import { useSuspenseHmms } from "../queries";
import { HmmInstall } from "./HmmInstall";
import HmmItem from "./HmmItem";

type HmmListProps = {
	term: string;
	page: number;
	setSearch: (
		next: { term?: string; page?: number },
		options?: { replace?: boolean },
	) => void;
};

/**
 * A list of HMMs with filtering options
 */
export default function HmmList({ term, page, setSearch }: HmmListProps) {
	const { data } = useSuspenseHmms(page, 25, term);

	const {
		items,
		page: storedPage,
		pageCount,
		foundCount,
		totalCount,
		status,
	} = data;

	return (
		<div>
			<ViewHeader title="HMMs">
				<ViewHeaderTitle>
					HMMs{" "}
					{status.task?.complete && (
						<ViewHeaderTitleBadge>{foundCount}</ViewHeaderTitleBadge>
					)}
				</ViewHeaderTitle>
			</ViewHeader>

			{totalCount ? (
				<>
					<SearchToolbar
						aria-label="Search HMMs"
						onChange={(term) => setSearch({ term, page: 1 }, { replace: true })}
						placeholder="Name"
						value={term}
					/>
					{items.length ? (
						<Pagination
							storedPage={storedPage}
							currentPage={page}
							pageCount={pageCount}
							onPageChange={(page) => setSearch({ page })}
						>
							<BoxGroup as="ul">
								{items.map((item) => (
									<HmmItem key={item.id} hmm={item} />
								))}
							</BoxGroup>
						</Pagination>
					) : (
						<ListEmpty
							icon={term ? SearchX : Boxes}
							title="No HMMs found"
							description={
								term ? "No HMMs match your search." : "No HMMs to show."
							}
						/>
					)}
				</>
			) : (
				<HmmInstall status={status} />
			)}
		</div>
	);
}
