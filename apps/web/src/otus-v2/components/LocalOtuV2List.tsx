import { useFuse } from "@app/fuse";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import { InputSearch } from "@base/Input";
import Link from "@base/Link";
import ListEmpty from "@base/ListEmpty";
import { useSuspenseLocalOtusV2 } from "@otus-v2/queries";
import { Dna, SearchX } from "lucide-react";
import type { ReactNode } from "react";

const OTU_SEARCH_KEYS = ["name", "acronym"];

/** A list of the local v2 OTUs in a Reference. */
export default function LocalOtuV2List({
	referenceId,
	toolbar,
}: {
	referenceId: string;
	toolbar: ReactNode;
}) {
	const { data: otus } = useSuspenseLocalOtusV2(referenceId);
	const [results, term, setTerm] = useFuse(otus, OTU_SEARCH_KEYS);

	const search = (
		<div className="flex flex-grow">
			<InputSearch
				aria-label="Search OTUs"
				placeholder="Search OTUs"
				value={term}
				onChange={(event) => setTerm(event.target.value)}
			/>
		</div>
	);

	if (otus.length === 0) {
		return (
			<>
				<div className="mb-4 flex justify-end gap-2">
					{search}
					{toolbar}
				</div>
				<ListEmpty
					icon={Dna}
					title="No OTUs found"
					description="No OTUs have been created in this reference yet."
				/>
			</>
		);
	}

	return (
		<>
			<div className="mb-4 flex justify-end gap-2">
				{search}
				{toolbar}
			</div>
			{results.length > 0 ? (
				<BoxGroup as="ul">
					{results.map((otu) => (
						<BoxGroupSection as="li" key={otu.id}>
							<Link
								className="font-medium text-lg"
								to="/refs/alpha/$referenceId/otus/$otuId"
								params={{ referenceId, otuId: otu.id }}
							>
								{otu.name}
								{otu.acronym ? ` (${otu.acronym})` : ""}
							</Link>
							<p className="text-gray-500">
								{otu.isolateCount}{" "}
								{otu.isolateCount === 1 ? "isolate" : "isolates"}
							</p>
							<p className="text-gray-500">Version {otu.version}</p>
						</BoxGroupSection>
					))}
				</BoxGroup>
			) : (
				<ListEmpty
					icon={SearchX}
					title="No OTUs found"
					description="No OTUs match your search."
				/>
			)}
		</>
	);
}
