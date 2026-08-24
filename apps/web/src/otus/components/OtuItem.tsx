import { BoxGroupSection } from "@base/Box";
import Link from "@base/Link";

type OtuItemProps = {
	abbreviation: string;
	id: string;
	name: string;
	refId: string;
	verified: boolean;
};

/**
 * A condensed OTU item for use in a list of OTUs
 */
export default function OtuItem({
	abbreviation,
	id,
	name,
	refId,
	verified,
}: OtuItemProps) {
	return (
		<BoxGroupSection
			as="li"
			className="grid items-center"
			style={{ gridTemplateColumns: "5fr 2fr 1fr" }}
		>
			<Link
				className="text-base font-medium"
				to="/refs/$refId/otus/$otuId"
				params={{ refId, otuId: id }}
			>
				{name}
			</Link>
			<span className="flex justify-start">{abbreviation}</span>
			{verified || <span className="flex justify-end">Unverified</span>}
		</BoxGroupSection>
	);
}
