import { BoxGroup, BoxGroupHeader } from "@base/Box";
import type { Read } from "@virtool/contracts";
import ReadItem from "./ReadItem";

type SampleReadsProps = {
	/** A list of reads used to create the sample */
	reads: Read[];
	/** The name of the sample */
	sampleName: string;
};

/**
 * Extract the read side (1 or 2) from a read filename like "reads_1.fq.gz"
 */
function extractReadSide(name: string): number {
	const digit = name.match(/reads_(\d+)/)?.[1];
	return digit ? parseInt(digit, 10) : 1;
}

/**
 * Displays a list of reads used to create the sample
 */
export default function SampleReads({ reads, sampleName }: SampleReadsProps) {
	const fileComponents = reads.map((file) => (
		<ReadItem
			key={file.name}
			downloadUrl={file.downloadUrl}
			sampleName={sampleName}
			side={extractReadSide(file.name)}
			size={file.size}
		/>
	));

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2 className="flex justify-between">Reads</h2>
				<p>The input sequencing data used to create this sample.</p>
			</BoxGroupHeader>
			{fileComponents}
		</BoxGroup>
	);
}
