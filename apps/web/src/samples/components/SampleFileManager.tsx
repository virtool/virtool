import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import ContainerNarrow from "@base/ContainerNarrow";
import { FileManager } from "@uploads/components/FileManager";
import type { Label, SortDirection, UploadSortField } from "@virtool/contracts";
import CreateSampleFromFile from "./Create/CreateSampleFromFile";

type SampleFileManagerProps = {
	direction: SortDirection;
	labels: Label[];
	page: number;
	setPage: (page: number) => void;
	setSort: (sort: UploadSortField, direction: SortDirection) => void;
	sort?: UploadSortField;
};

export default function SampleFileManager({
	direction,
	labels,
	page,
	setPage,
	setSort,
	sort,
}: SampleFileManagerProps) {
	const { hasPermission: canCreate } =
		useCheckAdminRoleOrPermission("create_sample");

	return (
		<ContainerNarrow>
			<FileManager
				accept={{
					"application/gzip": [".fasta.gz", ".fa.gz", ".fastq.gz", ".fq.gz"],
					"text/plain": [".fasta", ".fa", ".fastq", ".fq"],
				}}
				direction={direction}
				fileType="reads"
				page={page}
				hint="Supports plain or gzipped FASTA and FASTQ"
				regex={/\.f(ast)?q(\.gz)?$/}
				renderItemAction={
					canCreate
						? (upload, uploads) => (
								<CreateSampleFromFile
									labels={labels}
									upload={upload}
									uploads={uploads}
								/>
							)
						: undefined
				}
				setPage={setPage}
				setSort={setSort}
				sort={sort}
			/>
		</ContainerNarrow>
	);
}
