import Badge from "@base/Badge";
import Box from "@base/Box";
import { buttonVariants } from "@base/Button";
import SectionHeader from "@base/SectionHeader";
import { useSuspenseReferenceV2 } from "@references-v2/queries";
import { Link } from "@tanstack/react-router";

/** The detail page for a local v2 Reference. */
export default function ReferenceV2Detail({
	referenceId,
}: {
	referenceId: string;
}) {
	const { data: reference } = useSuspenseReferenceV2(referenceId);

	return (
		<div>
			<SectionHeader>
				<h2>
					{reference.name} <Badge color="purple">Beta</Badge>
				</h2>
				<p>{reference.description || "No description."}</p>
			</SectionHeader>

			<Box>
				<dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
					<dt className="font-semibold">Kind</dt>
					<dd>{reference.kind}</dd>
					<dt className="font-semibold">Default length tolerance</dt>
					<dd>{reference.defaultSegmentLengthTolerance}</dd>
					<dt className="font-semibold">Archived</dt>
					<dd>{reference.archived ? "Yes" : "No"}</dd>
				</dl>
			</Box>

			<div className="mt-4 flex gap-2">
				<Link
					className={buttonVariants({ color: "blue" })}
					to="/refs/beta/$referenceId/otus"
					params={{ referenceId }}
				>
					View OTUs
				</Link>
				<Link
					className={buttonVariants({ color: "gray" })}
					to="/refs/beta/$referenceId/otus/new"
					params={{ referenceId }}
				>
					Create OTU
				</Link>
			</div>
		</div>
	);
}
