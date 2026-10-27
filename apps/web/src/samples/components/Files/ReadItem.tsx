import { byteSize } from "@app/format";
import { BoxGroupSection } from "@base/Box";
import { getReadDownloadName } from "@virtool/contracts";

type ReadItemProps = {
	downloadUrl: string;
	/** The stored name of the read file */
	name: string;
	sampleName: string;
	/** The size of the read file in bytes */
	size: number;
};

/**
 * A condensed read item for use in a list of reads
 */
export default function ReadItem({
	downloadUrl,
	name,
	sampleName,
	size,
}: ReadItemProps) {
	return (
		<BoxGroupSection className="flex items-start font-medium justify-between">
			<div className="flex items-center">
				<div>
					<a href={downloadUrl}>{getReadDownloadName(sampleName, name)}</a>
				</div>
			</div>
			{byteSize(size, true)}
		</BoxGroupSection>
	);
}
