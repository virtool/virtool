import Badge from "@base/Badge";
import { BoxGroupSection } from "@base/Box";
import { InitialIcon } from "@base/Icon";

type ContributorProps = {
	id: number;
	count: number;
	handle: string;
};

/**
 * A condensed contributor item for use in a list of contributors
 */
export default function Contributor({ id, count, handle }: ContributorProps) {
	return (
		<BoxGroupSection className="flex items-center" key={id}>
			<InitialIcon handle={handle} size="md" className="mr-1" />
			{handle}
			<Badge className="ml-auto">
				{count} change{count === 1 ? "" : "s"}
			</Badge>
		</BoxGroupSection>
	);
}
