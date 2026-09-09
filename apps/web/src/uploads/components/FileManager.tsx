import { useFetchAccount } from "@account/account";
import { checkAdminRoleOrPermissionsFromAccount } from "@administration/utils";
import { byteSize, pluralize } from "@app/format";
import Alert from "@base/Alert";
import { BoxGroup, BoxGroupTable } from "@base/Box";
import Button from "@base/Button";
import Icon from "@base/Icon";
import ListEmpty from "@base/ListEmpty";
import ListHeader from "@base/ListHeader";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import Pagination from "@base/Pagination";
import QueryError from "@base/QueryError";
import { nextSortDirection } from "@base/sorting";
import { useListSelection } from "@base/useListSelection";
import { ViewHeader, ViewHeaderTitle, ViewHeaderTitleBadge } from "@base/View";
import type {
	SortDirection,
	Upload,
	UploadSortField,
	UploadType,
} from "@virtool/contracts";
import { capitalize } from "es-toolkit";
import { AlertCircle, FileUp, Trash } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import type { Accept } from "react-dropzone";
import { useDeleteFiles, useListFiles, useUploadPolicy } from "../queries";
import { upload } from "../uploader";
import { UploadBar } from "./UploadBar";
import UploadItem from "./UploadItem";
import UploadTableHead from "./UploadTableHead";

export type FileManagerProps = {
	/* The MIME-types and extensions to accept. */
	accept: Accept;

	/* The direction the sorted column is ordered in. */
	direction?: SortDirection;

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

	setSort?: (sort: UploadSortField, direction: SortDirection) => void;

	/* The column the list is sorted by, or undefined for newest first. */
	sort?: UploadSortField;
};

export function FileManager({
	accept,
	direction = "descending",
	fileType,
	hint,
	page = 1,
	regex,
	renderItemAction,
	setPage = () => {},
	setSort = () => {},
	sort,
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
	} = useListFiles(fileType, page, 25, sort, direction);

	// The uploads themselves are held, not just their ids, so a selection made on
	// one page survives paging away from it.
	const selection = useListSelection<Upload>({
		getKey: (item) => item.id,
		resetKey: fileType,
	});
	const { mutate: deleteFiles } = useDeleteFiles();
	const { data: policy } = useUploadPolicy();
	const [rejected, setRejected] = useState<string[]>([]);

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

	// Upload initialization enforces the limit even while the policy is loading.
	function handleDrop(acceptedFiles: File[]) {
		const maximum = policy?.maxUploadSize;
		const tooLarge =
			maximum === undefined
				? []
				: acceptedFiles.filter((file) => file.size > maximum);

		setRejected(tooLarge.map((file) => file.name));

		for (const file of acceptedFiles) {
			if (!tooLarge.includes(file)) {
				upload(file, fileType);
			}
		}
	}

	function handleDelete() {
		deleteFiles({ ids: selection.selected.map((item) => item.id) });
		selection.clear();
	}

	function handleSort(field: UploadSortField) {
		setSort(field, nextSortDirection(field, sort, direction));
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
				<>
					<UploadBar
						accept={accept}
						onDrop={handleDrop}
						hint={hint}
						regex={regex}
					/>
					{rejected.length > 0 && policy && (
						<Alert color="red" level icon={AlertCircle}>
							<span>
								<strong>
									{pluralize(rejected.length, "file")} exceeded the{" "}
									{byteSize(policy.maxUploadSize, true)} maximum upload size:
								</strong>
								<span> {rejected.join(", ")}</span>
							</span>
						</Alert>
					)}
				</>
			) : (
				<Alert color="orange" level icon={AlertCircle}>
					<span>
						<strong>You do not have permission to upload files.</strong>
						<span> Contact an administrator.</span>
					</span>
				</Alert>
			)}

			{files.foundCount === 0 ? (
				<ListEmpty
					description={
						canUpload
							? "Upload a file to get started."
							: "No files have been uploaded yet."
					}
					icon={FileUp}
					title="No files found"
				/>
			) : (
				<Pagination
					storedPage={files.page}
					currentPage={page}
					pageCount={files.pageCount}
					onPageChange={setPage}
				>
					<BoxGroup>
						<ListHeader
							label={
								selection.selected.length
									? `${selection.selected.length} selected`
									: pluralize(files.foundCount, "file")
							}
						>
							{canDelete && selection.selected.length > 0 && (
								<Button color="red" size="small" onClick={handleDelete}>
									<Icon icon={Trash} /> Delete
								</Button>
							)}
						</ListHeader>
						<BoxGroupTable className="table-fixed" variant="data">
							<caption className="sr-only">{title}</caption>
							<UploadTableHead
								checked={selection.getVisibleState(files.items)}
								direction={direction}
								onSelectAll={
									canDelete
										? () => selection.toggleVisible(files.items)
										: undefined
								}
								onSort={handleSort}
								sort={sort}
							/>
							<tbody>
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
							</tbody>
						</BoxGroupTable>
					</BoxGroup>
				</Pagination>
			)}
		</>
	);
}
