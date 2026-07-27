import { byteSize } from "@app/format";
import BoxGroupSection from "@base/BoxGroupSection";

/**
 * Sanitize a string for use as a filename by replacing invalid characters
 * with underscores.
 */
function sanitizeFileName(name: string): string {
	return name.replace(/[/\\:*?"<>|\s]/g, "_");
}

type ReadItemProps = {
	downloadUrl: string;
	sampleName: string;
	side: number;
	/** The size of the read file in bytes */
	size: number;
};

/**
 * A condensed read item for use in a list of reads
 */
export default function ReadItem({
	downloadUrl,
	sampleName,
	side,
	size,
}: ReadItemProps) {
	const downloadName = `${sanitizeFileName(sampleName)}_${side}.fq.gz`;

	return (
		<BoxGroupSection className="flex items-start font-medium justify-between">
			<div className="flex items-center">
				<div>
					<a href={`/api/${downloadUrl}`} download={downloadName}>
						{downloadName}
					</a>
				</div>
			</div>
			{byteSize(size, true)}
		</BoxGroupSection>
	);
}
