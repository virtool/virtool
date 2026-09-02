import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import { useFuse } from "@app/fuse";
import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import { InputSearch } from "@base/Input";
import Link from "@base/Link";
import ListEmpty from "@base/ListEmpty";
import { useSuspenseReferencesV2 } from "@references-v2/queries";
import { Library, SearchX } from "lucide-react";
import { useState } from "react";
import CreateReferenceV2 from "./CreateReferenceV2";

const REFERENCE_SEARCH_KEYS = ["name"];

/** A list of v2 References visible to the current user. */
export default function ReferenceV2List() {
	const { data: references } = useSuspenseReferencesV2();
	const { hasPermission: canCreate } =
		useCheckAdminRoleOrPermission("create_ref");
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [results, term, setTerm] = useFuse(references, REFERENCE_SEARCH_KEYS);

	return (
		<>
			<div className="mb-4 flex gap-2">
				<InputSearch
					aria-label="Search references"
					placeholder="Search references"
					value={term}
					onChange={(event) => setTerm(event.target.value)}
				/>
				{canCreate && (
					<Button color="blue" onClick={() => setIsCreateOpen(true)}>
						Create
					</Button>
				)}
			</div>

			{references.length === 0 ? (
				<ListEmpty
					icon={Library}
					title="No alpha references found"
					description="No alpha references have been created yet."
				/>
			) : results.length > 0 ? (
				<BoxGroup as="ul">
					{results.map((reference) => (
						<BoxGroupSection
							as="li"
							className="grid grid-cols-[1fr_auto] items-center gap-4"
							key={reference.id}
						>
							<div>
								<Link
									className="font-medium text-lg"
									to="/refs/alpha/$referenceId"
									params={{ referenceId: reference.id }}
								>
									{reference.name}
								</Link>
								{reference.description && (
									<p className="text-gray-500">{reference.description}</p>
								)}
							</div>
							{reference.archived && (
								<Badge color="gray" variant="soft">
									Archived
								</Badge>
							)}
						</BoxGroupSection>
					))}
				</BoxGroup>
			) : (
				<ListEmpty
					icon={SearchX}
					title="No references found"
					description="No references match your search."
				/>
			)}

			<CreateReferenceV2 open={isCreateOpen} onOpenChange={setIsCreateOpen} />
		</>
	);
}
