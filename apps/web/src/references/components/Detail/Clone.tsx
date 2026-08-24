import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "@base/Box";
import { Link } from "@tanstack/react-router";

type CloneProps = {
	source: { id: number; name: string };
};

export function Clone({ source }: CloneProps) {
	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2>Clone Reference</h2>
			</BoxGroupHeader>

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
	);
}
