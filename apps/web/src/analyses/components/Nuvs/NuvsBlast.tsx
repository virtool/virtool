import NuvsBlastResults from "@analyses/components/Nuvs/NuvsBlastResults";
import { useBlastNuvs } from "@analyses/queries";
import type { FormattedNuvsHit } from "@analyses/types";
import Alert from "@base/Alert";
import Box from "@base/Box";
import Button from "@base/Button";
import { Info } from "lucide-react";
import NuvsBlastError from "./NuvsBlastError";
import NuvsBlastPending from "./NuvsBlastPending";

type NuVsBLASTProps = {
	analysisId: number;
	/** Complete information for a Nuvs hit */
	hit: FormattedNuvsHit;
};

/**
 * Displays option to install Nuvs blast information
 */
export default function NuvsBlast({ analysisId, hit }: NuVsBLASTProps) {
	const { blast, index } = hit;
	const mutation = useBlastNuvs(analysisId);

	function handleBlast() {
		mutation.mutate({ sequenceIndex: index });
	}

	if (blast) {
		if (blast.error) {
			return <NuvsBlastError error={blast.error} onBlast={handleBlast} />;
		}

		if (blast.ready) {
			if (blast.result?.hits.length) {
				return (
					<NuvsBlastResults hits={blast.result.hits} onBlast={handleBlast} />
				);
			}

			return (
				<Box>
					<h4 className="font-medium mt-1 mb-4">NCBI BLAST</h4>
					<p>No BLAST hits found.</p>
				</Box>
			);
		}

		return (
			<NuvsBlastPending
				interval={blast.interval ?? 0}
				lastCheckedAt={blast.lastCheckedAt}
				rid={blast.rid ?? ""}
			/>
		);
	}

	return (
		<Alert color="purple" level icon={Info}>
			<span>This sequence has no BLAST information attached to it.</span>
			<Button className="ml-auto" color="purple" onClick={handleBlast}>
				BLAST at NCBI
			</Button>
		</Alert>
	);
}
