import { useCheckAdminRoleOrPermission } from "@administration/hooks";
import ContainerNarrow from "@base/ContainerNarrow";
import { FileManager } from "@uploads/components/FileManager";
import type { Label } from "@virtool/contracts";
import CreateSampleFromFile from "./Create/CreateSampleFromFile";

type SampleFileManagerProps = {
	labels: Label[];
	page: number;
	setPage: (page: number) => void;
};

export default function SampleFileManager({
	labels,
	page,
	setPage,
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
			/>
		</ContainerNarrow>
	);
}
