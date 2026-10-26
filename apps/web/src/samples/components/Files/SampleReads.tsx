import { BoxGroup } from "@base/Box";
import SectionHeader from "@base/SectionHeader";
import type { Read } from "@virtool/contracts";
import ReadItem from "./ReadItem";

type SampleReadsProps = {
	/** A list of reads used to create the sample */
	reads: Read[];
	/** The name of the sample */
	sampleName: string;
};

/**
 * Displays a list of reads used to create the sample
 */
export default function SampleReads({ reads, sampleName }: SampleReadsProps) {
	const fileComponents = reads.map((file) => (
		<ReadItem
			key={file.name}
			downloadUrl={file.downloadUrl}
			name={file.name}
			sampleName={sampleName}
			size={file.size}
		/>
	));

	return (
		<section>
			<SectionHeader>
				<h2>Reads</h2>
				<p>The input sequencing data used to create this sample.</p>
			</SectionHeader>
			<BoxGroup>{fileComponents}</BoxGroup>
		</section>
	);
}
