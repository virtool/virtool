import { BoxGroup, BoxGroupSection } from "@base/Box";
import { InitialIcon, UserAvatar } from "@base/Icon";
import SectionHeader from "@base/SectionHeader";
import type { UserIdentity } from "@virtool/contracts";
import { MailClock } from "lucide-react";

type MemberProps = {
	members: UserIdentity[];
};

export function GroupMembers({ members }: MemberProps) {
	const memberComponents = members.map((member) => (
		<BoxGroupSection key={member.id}>
			<div className="flex gap-2.5">
				{member.lifecycleState === "pending" ? (
					<>
						<InitialIcon size="md" icon={MailClock} label="Invited user" />
						<span className="text-gray-500 italic">No username yet</span>
					</>
				) : (
					<>
						<UserAvatar username={member.username} size="md" />
						{member.username}
					</>
				)}
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
