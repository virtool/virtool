import { FileManager } from "@uploads/components/FileManager";
import type { SortDirection, UploadSortField } from "@virtool/contracts";

type SubtractionFileManagerProps = {
	direction?: SortDirection;
	page?: number;
	setPage?: (page: number) => void;
	setSort?: (sort: UploadSortField, direction: SortDirection) => void;
	sort?: UploadSortField;
};

/**
 * Displays a list of subtraction uploads with functionality to upload/delete uploads
 */
export function SubtractionFileManager({
	direction,
	page = 1,
	setPage = () => {},
	setSort,
	sort,
}: SubtractionFileManagerProps) {
	return (
		<FileManager
			accept={{
				"application/gzip": [".fasta.gz", ".fa.gz"],
				"application/text": [".fasta", ".fa"],
			}}
			direction={direction}
			fileType="subtraction"
			page={page}
			hint="Supports plain or gzipped FASTA"
			regex={/\.(?:fa|fasta)(?:\.gz|\.gzip)?$/}
			setPage={setPage}
			setSort={setSort}
			sort={sort}
		/>
	);
}
