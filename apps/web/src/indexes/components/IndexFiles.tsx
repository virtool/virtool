import Badge from "@base/Badge";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import type { IndexFile } from "@virtool/contracts";
import { IndexFileItem } from "./IndexFileItem";

type IndexFilesProps = {
	files: IndexFile[];
};

/**
 * A list of the uploads associated with the index
 */
export default function IndexFiles({ files }: IndexFilesProps) {
	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2 className="flex items-center gap-2">
					<span>Files</span>
					<Badge>{files.length}</Badge>
				</h2>
				Data files available to workflows using this index.
			</BoxGroupHeader>
			{files.map((file: IndexFile) => (
				<IndexFileItem
					key={file.id}
					downloadUrl={file.downloadUrl}
					name={file.name}
					size={file.size ?? 0}
				/>
			))}
		</BoxGroup>
	);
}
