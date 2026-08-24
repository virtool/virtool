import { useFuse } from "@app/fuse";
import { getContentScrollElement } from "@app/scroll";
import { formatIsolateName } from "@app/utils";
import Box from "@base/Box";
import Button from "@base/Button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import { InputSearch } from "@base/Input";
import { SubviewHeader } from "@base/Subview";
import Toolbar from "@base/Toolbar";
import { useCurrentOtuContext } from "@otus/components/CurrentOtuContext";
import {
	useCheckReferenceRight,
	useReferenceIsArchived,
} from "@references/hooks";
import { ClientOnly, getRouteApi } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { OtuIsolate } from "@virtool/contracts";
import { TestTubes } from "lucide-react";
import { useCallback, useState } from "react";
import CreateIsolate from "./CreateIsolate";
import DeleteIsolate from "./DeleteIsolate";
import IsolateItem from "./IsolateItem";

const routeApi = getRouteApi(
	"/_authenticated/refs/$refId/otus/$otuId/isolates/",
);

const ISOLATE_SEARCH_KEYS = [
	"sourceName",
	"sequences.accession",
	"sequences.definition",
];

const ROW_HEIGHT = 48;

/**
 * A virtualized, searchable list of an OTU's isolates
 */
export default function IsolateList() {
	const { refId, otuId } = routeApi.useParams();
	const { otu, reference } = useCurrentOtuContext();
	const { isolates } = otu;
	const { restrictSourceTypes, sourceTypes } = reference;

	const [openCreate, setOpenCreate] = useState(false);
	const [isolateToDelete, setIsolateToDelete] = useState<OtuIsolate | null>(
		null,
	);

	const { hasPermission: canModify } = useCheckReferenceRight(
		reference.id,
		"modifyOtu",
	);
	const archived = useReferenceIsArchived(reference.id);
	const canModifyIsolates = canModify && !archived;

	const [results, term, setTerm] = useFuse<OtuIsolate>(
		isolates,
		ISOLATE_SEARCH_KEYS,
	);

	const [scrollMargin, setScrollMargin] = useState(0);

	// A ref callback, not a mount effect: ClientOnly swaps in this element
	// after hydration, on a render the initial mount effect would not rerun
	// for, so the measurement has to fire off the element's own attachment.
	const listRef = useCallback((node: HTMLDivElement | null) => {
		const scrollElement = getContentScrollElement();
		if (node && scrollElement) {
			const top =
				node.getBoundingClientRect().top -
				scrollElement.getBoundingClientRect().top +
				scrollElement.scrollTop;
			setScrollMargin(top);
		}
	}, []);

	const virtualizer = useVirtualizer({
		count: results.length,
		getScrollElement: getContentScrollElement,
		estimateSize: () => ROW_HEIGHT,
		overscan: 8,
		scrollMargin,
	});

	return (
		<>
			<SubviewHeader>
				<Toolbar>
					<InputSearch
						aria-label="Search sequences"
						placeholder="Name, accession, or definition"
						value={term}
						onChange={(e) => setTerm(e.target.value)}
					/>
					{canModifyIsolates && (
						<Button color="blue" onClick={() => setOpenCreate(true)}>
							Create
						</Button>
					)}
				</Toolbar>
			</SubviewHeader>

			{results.length ? (
				<>
					{term && (
						<p className="mb-2 text-sm text-gray-500">
							Showing {results.length} of {isolates.length}
						</p>
					)}
					{/* Which rows are virtualized depends on measuring the page's scroll
					    container, which does not exist while rendering on the server — so
					    the server would emit an empty list and hydration would find a full
					    one. The fallback holds the same height, so the rows land without
					    moving anything below them. */}
					<ClientOnly
						fallback={
							<div
								className="border border-gray-300 rounded overflow-hidden"
								style={{ height: results.length * ROW_HEIGHT }}
							/>
						}
					>
						<div className="border border-gray-300 rounded overflow-hidden">
							<div
								ref={listRef}
								className="relative w-full"
								style={{ height: virtualizer.getTotalSize() }}
							>
								{virtualizer.getVirtualItems().map((virtualRow) => {
									const isolate = results[virtualRow.index];
									if (!isolate) {
										return null;
									}
									return (
										<div
											key={isolate.id}
											className="absolute left-0 top-0 w-full"
											style={{
												height: virtualRow.size,
												transform: `translateY(${virtualRow.start - scrollMargin}px)`,
											}}
										>
											<IsolateItem
												isolate={isolate}
												refId={refId}
												otuId={otuId}
												canDelete={canModifyIsolates}
												onDelete={setIsolateToDelete}
											/>
										</div>
									);
								})}
							</div>
						</div>
					</ClientOnly>
				</>
			) : (
				<Box>
					<Empty className="h-72">
						<EmptyMedia className="text-gray-400">
							<TestTubes size={40} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No isolates found</EmptyTitle>
						<EmptyDescription>This OTU has no isolates yet.</EmptyDescription>
					</Empty>
				</Box>
			)}

			<CreateIsolate
				allowedSourceTypes={sourceTypes}
				otuId={otu.id}
				restrictSourceTypes={restrictSourceTypes}
				show={openCreate}
				onHide={() => setOpenCreate(false)}
			/>

			<DeleteIsolate
				id={isolateToDelete?.id ?? ""}
				name={isolateToDelete ? formatIsolateName(isolateToDelete) : ""}
				onHide={() => setIsolateToDelete(null)}
				otuId={otuId}
				show={Boolean(isolateToDelete)}
			/>
		</>
	);
}
