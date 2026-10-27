import { BoxGroup, BoxGroupSection } from "@base/Box";
import SectionHeader from "@base/SectionHeader";
import { Link } from "@tanstack/react-router";

type CloneProps = {
	source: { id: number; name: string };
};

export function Clone({ source }: CloneProps) {
	return (
		<section>
			<SectionHeader>
				<h2>Clone Reference</h2>
			</SectionHeader>

			<BoxGroup>
				<BoxGroupSection>
					<strong>Source Reference</strong>
					<span>
						{" / "}
						<Link to="/refs/$refId" params={{ refId: String(source.id) }}>
							{source.name}
						</Link>
					</span>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
