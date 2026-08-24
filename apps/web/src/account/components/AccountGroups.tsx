import { cn } from "@app/cn";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import type { GroupMinimal } from "@virtool/contracts";
import { Users } from "lucide-react";

type AccountGroupsProps = {
	/** A list of groups associated with the account */
	groups: GroupMinimal[];
};

/**
 * Displays the groups associated with the account
 */
export default function AccountGroups({ groups }: AccountGroupsProps) {
	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2>Groups</h2>
			</BoxGroupHeader>
			<BoxGroupSection className="flex flex-wrap gap-2">
				{groups.length ? (
					groups
						.sort((a, b) => a.name.localeCompare(b.name))
						.map(({ id, name }) => (
							<span
								className={cn(
									"bg-slate-500",
									"inline-flex",
									"font-medium",
									"items-center",
									"text-white",
									"px-2 py-1",
									"rounded",
								)}
								key={id}
							>
								{name}
							</span>
						))
				) : (
					<Empty className="h-72">
						<EmptyMedia className="text-gray-400">
							<Users size={40} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No groups found</EmptyTitle>
						<EmptyDescription>
							You do not belong to any groups.
						</EmptyDescription>
					</Empty>
				)}
			</BoxGroupSection>
		</BoxGroup>
	);
}
