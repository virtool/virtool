import { BoxGroup, BoxGroupHeader, BoxGroupTable } from "@base/Box";
import { ContainerNarrow } from "@base/Container";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import Contributors from "@indexes/components/Contributors";
import { useFetchReference } from "@references/queries";
/**
 * Display and edit information for a reference
 */
import { getRouteApi } from "@tanstack/react-router";
import { Clone } from "./Clone";
import { LatestBuild } from "./LatestBuild";

const routeApi = getRouteApi("/_authenticated/refs/$refId");

export default function ReferenceManager() {
	const { refId } = routeApi.useParams();
	const {
		data: reference,
		isPending,
		isError,
	} = useFetchReference(Number(refId));

	if (isError && !reference) {
		return <QueryError noun="reference" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	const { clonedFrom, contributors, description, latestBuild, organism } =
		reference;

	return (
		<ContainerNarrow>
			<BoxGroup>
				<BoxGroupHeader>
					<h2>General</h2>
				</BoxGroupHeader>
				<BoxGroupTable className="[&_th]:w-45 [&_tr:not(:first-of-type)_td]:capitalize">
					<caption className="sr-only">Reference general information</caption>
					<tbody>
						<tr>
							<th scope="row">Description</th>
							<td>{description}</td>
						</tr>
						<tr>
							<th scope="row">Organism</th>
							<td>{organism}</td>
						</tr>
					</tbody>
				</BoxGroupTable>
			</BoxGroup>

			{clonedFrom && <Clone source={clonedFrom} />}

			<BoxGroup>
				<BoxGroupHeader>
					<h2>Latest Index Build</h2>
				</BoxGroupHeader>
				<LatestBuild id={refId} latestBuild={latestBuild} />
			</BoxGroup>

			<Contributors contributors={contributors} />
		</ContainerNarrow>
	);
}
