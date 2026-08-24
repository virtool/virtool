import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import { InitialIcon } from "@base/Icon";
import type { UserNested } from "@virtool/contracts";

type MemberProps = {
	members: UserNested[];
};

export function GroupMembers({ members }: MemberProps) {
	const memberComponents = members.map((member: UserNested) => (
		<BoxGroupSection key={member.id}>
			<div className="flex gap-2.5">
				<InitialIcon handle={member.handle} size="md" />
				{member.handle}
			</div>
		</BoxGroupSection>
	));

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2>Members</h2>
			</BoxGroupHeader>

			{memberComponents}
			{Boolean(memberComponents.length) || (
				<BoxGroupSection key="no-members">
					<div className="flex items-center justify-center py-6">
						No Group Members
					</div>
				</BoxGroupSection>
			)}
		</BoxGroup>
	);
}
