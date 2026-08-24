import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import ScrollArea from "@base/ScrollArea";
import { sortBy } from "es-toolkit";

type HmmTaxonomyProps = {
	/** The names and corresponding counts of the taxonomy items */
	counts: { [key: string]: number };
	/** The subtitle to be displayed */
	subtitle: string;
};

/**
 * Displays a list of taxonomy items
 */
export function HmmTaxonomy({ counts, subtitle }: HmmTaxonomyProps) {
	const sorted = sortBy(
		Object.entries(counts).map(([name, count]) => ({ name, count })),
		["name"],
	);

	const components = sorted.map(({ name, count }) => (
		<BoxGroupSection key={name} className="flex justify-between">
			{name} <Badge>{count}</Badge>
		</BoxGroupSection>
	));

	return (
		<section>
			<header className="mb-4">
				<h4 className="font-medium">{subtitle}</h4>
			</header>
			<BoxGroup>
				<ScrollArea className="w-full h-52 border-none rounded-none mr-0">
					{components}
				</ScrollArea>
			</BoxGroup>
		</section>
	);
}
