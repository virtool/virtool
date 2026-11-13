import Badge from "@base/Badge";
import { BoxGroupSection } from "@base/Box";
import { UserAvatar } from "@base/Icon";

type ContributorProps = {
	id: number;
	count: number;
	username: string;
};

/**
 * A condensed contributor item for use in a list of contributors
 */
export default function Contributor({ id, count, username }: ContributorProps) {
	return (
		<BoxGroupSection className="flex items-center" key={id}>
			<UserAvatar username={username} size="md" className="mr-1" />
			{username}
			<Badge className="ml-auto">
				{count} change{count === 1 ? "" : "s"}
			</Badge>
		</BoxGroupSection>
	);
}
