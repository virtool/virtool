import { BoxGroup, BoxGroupSection } from "@base/Box";
import { UserAvatar } from "@base/Icon";
import SectionHeader from "@base/SectionHeader";
import type { UserNested } from "@virtool/contracts";

type MemberProps = {
	members: UserNested[];
};

export function GroupMembers({ members }: MemberProps) {
	const memberComponents = members.map((member: UserNested) => (
		<BoxGroupSection key={member.id}>
			<div className="flex gap-2.5">
				<UserAvatar handle={member.handle} size="md" />
				{member.handle}
			</div>
		</BoxGroupSection>
	));

	return (
		<section>
			<SectionHeader>
				<h2>Members</h2>
			</SectionHeader>
			<BoxGroup>
				{memberComponents}
				{Boolean(memberComponents.length) || (
					<BoxGroupSection key="no-members">
						<div className="flex items-center justify-center py-6">
							No Group Members
						</div>
					</BoxGroupSection>
				)}
			</BoxGroup>
		</section>
	);
}
