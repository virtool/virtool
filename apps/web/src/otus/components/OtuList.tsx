import { DEFAULT_PER_PAGE } from "@app/pagination";
import BoxGroup from "@base/BoxGroup";
import Button from "@base/Button";
import ContainerNarrow from "@base/ContainerNarrow";
import ListEmpty from "@base/ListEmpty";
import Pagination from "@base/Pagination";
import RebuildAlert from "@indexes/components/RebuildAlert";
import { useSuspenseOtus } from "@otus/queries";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import { getRouteApi } from "@tanstack/react-router";
import { Inbox, SearchX } from "lucide-react";
import { useState } from "react";
import OtuCreate from "./OtuCreate";
import OtuItem from "./OtuItem";
import OtuToolbar from "./OtuToolbar";

const routeApi = getRouteApi("/_authenticated/refs/$refId/otus/");

type OtuListProps = {
	term: string;
	page: number;
	setSearch: (
		next: { term?: string; page?: number },
		options?: { replace?: boolean },
	) => void;
};

/**
 * A list of OTUs with filtering
 */
export default function OtuList({ term, page, setSearch }: OtuListProps) {
	const { refId } = routeApi.useParams();
	const referenceId = Number(refId);
	const [openCreate, setOpenCreate] = useState(false);
	const { data: otus } = useSuspenseOtus(
		referenceId,
		page,
		DEFAULT_PER_PAGE,
		term,
	);
	const { hasPermission: canModifyOtu } = useCheckReferenceRight(
		referenceId,
		"modifyOtu",
	);
	const archived = useReferenceIsArchived(referenceId);

	const { items, page: storedPage, pageCount } = otus;

	const canCreate = canModifyOtu && !archived;
	const isUnfilteredEmpty = !items.length && !term;

	return (
		<ContainerNarrow>
			<RebuildAlert page={page} refId={refId} />
			{!isUnfilteredEmpty && (
				<OtuToolbar
					term={term}
					setTerm={(term) => setSearch({ term, page: 1 }, { replace: true })}
					onCreate={() => setOpenCreate(true)}
					referenceId={referenceId}
				/>
			)}
			<OtuCreate
				open={openCreate}
				refId={referenceId}
				setOpen={setOpenCreate}
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
							<OtuItem key={item.id} {...item} refId={refId} />
						))}
					</BoxGroup>
				</Pagination>
			) : (
				<ListEmpty
					icon={term ? SearchX : Inbox}
					title="No OTUs found"
					description={
						term
							? "No OTUs match your search."
							: "This reference has no OTUs yet."
					}
				>
					{isUnfilteredEmpty && canCreate && (
						<Button color="blue" onClick={() => setOpenCreate(true)}>
							Create OTU
						</Button>
					)}
				</ListEmpty>
			)}
		</ContainerNarrow>
	);
}
