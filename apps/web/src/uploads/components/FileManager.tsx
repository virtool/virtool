import { useFetchAccount } from "@account/account";
import { checkAdminRoleOrPermissionsFromAccount } from "@administration/utils";
import Alert from "@base/Alert";
import Box from "@base/Box";
import BoxGroup from "@base/BoxGroup";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import Pagination from "@base/Pagination";
import QueryError from "@base/QueryError";
import { useListSelection } from "@base/useListSelection";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import ViewHeaderTitleBadge from "@base/ViewHeaderTitleBadge";
import type { Upload, UploadType } from "@virtool/contracts";
import { capitalize } from "es-toolkit";
import { AlertCircle, FileUp } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import type { Accept } from "react-dropzone";
import { useDeleteFiles, useListFiles } from "../queries";
import { upload } from "../uploader";
import { UploadBar } from "./UploadBar";
import UploadItem from "./UploadItem";
import UploadListHeader from "./UploadListHeader";

export type FileManagerProps = {
	/* The MIME-types and extensions to accept. */
	accept: Accept;

	/* The type of file accepted. */
	fileType: UploadType;

	/* A note shown under the upload prompt, describing the accepted file types. */
	hint?: ReactNode;

	page?: number;

	/* A regular expression to validate file names. */
	regex?: RegExp;

	/* Renders an extra control on each file item, given the file and the other
	   files listed with it. */
	renderItemAction?: (upload: Upload, uploads: Upload[]) => ReactNode;

	setPage?: (page: number) => void;
};

export function FileManager({
	accept,
	fileType,
	hint,
	page = 1,
	regex,
	renderItemAction,
	setPage = () => {},
}: FileManagerProps) {
	const {
		data: account,
		isPending: isPendingAccount,
		isError: isErrorAccount,
	} = useFetchAccount();
	const {
		data: files,
		isPending: isPendingFiles,
		isError: isErrorFiles,
	} = useListFiles(fileType, page, 25);

	// The uploads themselves are held, not just their ids, so a selection made on
	// one page survives paging away from it.
	const selection = useListSelection<Upload>({
		getKey: (item) => item.id,
		resetKey: fileType,
	});
	const { mutate: deleteFiles } = useDeleteFiles();

	if (isErrorAccount && !account) {
		return <QueryError noun="account" />;
	}

	if (isErrorFiles && !files) {
		return <QueryError noun="files" />;
	}

	if (isPendingFiles || isPendingAccount) {
		return <LoadingPlaceholder />;
	}

	const canUpload = checkAdminRoleOrPermissionsFromAccount(
		account,
		"upload_file",
	);
	const canDelete = checkAdminRoleOrPermissionsFromAccount(
		account,
		"remove_file",
	);

	const title = `${fileType === "reads" ? "Read" : capitalize(fileType)} Files`;

	function handleDrop(acceptedFiles: File[]) {
		for (const file of acceptedFiles) {
			upload(file, fileType);
		}
	}

	function handleDelete() {
		deleteFiles({ ids: selection.selected.map((item) => item.id) });
		selection.clear();
	}

	return (
		<>
			<ViewHeader title={title}>
				<ViewHeaderTitle>
					{title}{" "}
					<ViewHeaderTitleBadge>{files.foundCount}</ViewHeaderTitleBadge>
				</ViewHeaderTitle>
			</ViewHeader>

			{canUpload ? (
				<UploadBar
					accept={accept}
					onDrop={handleDrop}
					hint={hint}
					regex={regex}
				/>
			) : (
				<Alert color="orange" level icon={AlertCircle}>
					<span>
						<strong>You do not have permission to upload files.</strong>
						<span> Contact an administrator.</span>
					</span>
				</Alert>
			)}

			{files.foundCount === 0 ? (
				<Box>
					<Empty className="h-72">
						<EmptyMedia className="text-gray-400">
							<FileUp size={40} strokeWidth={1.5} />
						</EmptyMedia>
						<EmptyTitle>No files found</EmptyTitle>
						<EmptyDescription>
							{canUpload
								? "Upload a file to get started."
								: "No files have been uploaded yet."}
						</EmptyDescription>
					</Empty>
				</Box>
			) : (
				<Pagination
					storedPage={files.page}
					currentPage={page}
					pageCount={files.pageCount}
					onPageChange={setPage}
				>
					<BoxGroup>
						{canDelete && (
							<UploadListHeader
								canDelete={canDelete}
								checked={selection.getVisibleState(files.items)}
								found={files.foundCount}
								onDelete={handleDelete}
								onSelectAll={() => selection.toggleVisible(files.items)}
								selectedCount={selection.selected.length}
							/>
						)}
						<ul className="list-none">
							{files.items.map((item) => (
								<UploadItem
									{...item}
									action={renderItemAction?.(item, files.items)}
									canDelete={canDelete}
									checked={selection.isSelected(item)}
									key={item.id}
									onSelect={
										canDelete
											? (event: MouseEvent<HTMLButtonElement>) =>
													selection.select(item, {
														shiftKey: event.shiftKey,
														visibleItems: files.items,
													})
											: undefined
									}
								/>
							))}
						</ul>
					</BoxGroup>
				</Pagination>
			)}
		</>
	);
}
