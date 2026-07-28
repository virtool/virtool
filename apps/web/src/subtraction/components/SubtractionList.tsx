import BoxGroup from "@base/BoxGroup";
import ListEmpty from "@base/ListEmpty";
import Pagination from "@base/Pagination";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import ViewHeaderTitleBadge from "@base/ViewHeaderTitleBadge";
import { Scissors } from "lucide-react";
import { useSuspenseSubtractions } from "../queries";
import { SubtractionItem } from "./SubtractionItem";
import SubtractionToolbar from "./SubtractionToolbar";

type SubtractionListProps = {
	term?: string;
	page?: number;
	setSearch?: (
		next: { term?: string; page?: number },
		options?: { replace?: boolean },
	) => void;
};

/**
 * A list of subtractions.
 */
export default function SubtractionList({
	term = "",
	page = 1,
	setSearch = () => {},
}: SubtractionListProps) {
	const { data } = useSuspenseSubtractions(page, 25, term);

	const { items, totalCount, page: storedPage, pageCount } = data;

	return (
		<>
			<ViewHeader title="Subtractions">
				<ViewHeaderTitle>
					Subtractions <ViewHeaderTitleBadge>{totalCount}</ViewHeaderTitleBadge>
				</ViewHeaderTitle>
			</ViewHeader>

			<SubtractionToolbar
				term={term}
				onChange={(term) => setSearch({ term, page: 1 }, { replace: true })}
			/>

			{!items.length ? (
				<ListEmpty
					icon={Scissors}
					title="No subtractions found"
					description="No subtractions have been created yet."
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
							<SubtractionItem key={item.id} {...item} />
						))}
					</BoxGroup>
				</Pagination>
			)}
		</>
	);
}
