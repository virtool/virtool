import { BoxGroup, BoxGroupSection } from "@base/Box";
import SectionHeader from "@base/SectionHeader";
import { useSuspenseReference } from "@references/queries";
import { getRouteApi } from "@tanstack/react-router";

const routeApi = getRouteApi("/_authenticated/refs/$refId");

export function ArchivedSourceTypes() {
	const { refId } = routeApi.useParams();
	const { data } = useSuspenseReference(Number(refId));

	const sourceTypes = data.sourceTypes ?? [];

	return (
		<section>
			<SectionHeader className="mb-2">
				<h2>Source Types</h2>
			</SectionHeader>
			<p className="mb-1 text-sm text-gray-500">Read only - archived</p>
			<BoxGroup>
				{sourceTypes.length ? (
					sourceTypes.map((sourceType) => (
						<BoxGroupSection key={sourceType}>
							<span className="capitalize text-gray-600">{sourceType}</span>
						</BoxGroupSection>
					))
				) : (
					<BoxGroupSection className="text-gray-500 text-sm">
						No source types configured.
					</BoxGroupSection>
				)}
			</BoxGroup>
		</section>
	);
}
