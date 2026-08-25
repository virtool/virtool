import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import Link from "@base/Link";
import ListEmpty from "@base/ListEmpty";
import { useSuspenseReferencesV2 } from "@references-v2/queries";
import { Library } from "lucide-react";
import { useState } from "react";
import CreateReferenceV2 from "./CreateReferenceV2";

/** A list of v2 References visible to the current user. */
export default function ReferenceV2List() {
	const { data: references } = useSuspenseReferencesV2();
	const { hasPermission: canCreate } =
		useCheckAdminRoleOrPermission("create_ref");
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	return (
		<>
			{canCreate && (
				<div className="mb-4 flex justify-end">
					<Button color="blue" onClick={() => setIsCreateOpen(true)}>
						Create
					</Button>
				</div>
			)}

			{references.length === 0 ? (
				<ListEmpty
					icon={Library}
					title="No beta references found"
					description="No beta references have been created yet."
				/>
			) : (
				<BoxGroup as="ul">
					{references.map((reference) => (
						<BoxGroupSection
							as="li"
							className="grid grid-cols-[1fr_auto] items-center gap-4"
							key={reference.id}
						>
							<div>
								<Link
									className="font-medium text-lg"
									to="/refs/beta/$referenceId"
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
			)}

			<CreateReferenceV2 open={isCreateOpen} onOpenChange={setIsCreateOpen} />
		</>
	);
}
