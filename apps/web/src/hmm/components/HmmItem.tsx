import { BoxGroupSection } from "@base/Box";
import Label from "@base/Label";
import Link from "@base/Link";
import type { HmmMinimal } from "@virtool/contracts";

type HmmItemProps = {
	/** Minimal hmm data */
	hmm: HmmMinimal;
};

/**
 * A condensed hmm item for use in a list of hmms
 */
export default function HmmItem({ hmm }: HmmItemProps) {
	const filteredFamilies = Object.keys(hmm.families).filter(
		(family) => family !== "None",
	);

	const labelComponents = filteredFamilies
		.slice(0, 3)
		.map((family) => <Label key={family}>{family}</Label>);

	return (
		<BoxGroupSection as="li" className="flex text-lg">
			<strong className="shrink-0 grow-0 basis-12 font-bold">
				{hmm.cluster}
			</strong>
			<Link
				className="flex-1 shrink-0"
				to="/hmms/$hmmId"
				params={{ hmmId: String(hmm.id) }}
			>
				{hmm.names[0]}
			</Link>
			<div className="flex items-center text-base ml-auto gap-1.5">
				{labelComponents} {filteredFamilies.length > 3 ? "..." : null}
			</div>
		</BoxGroupSection>
	);
}
