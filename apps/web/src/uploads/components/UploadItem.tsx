import { byteSize } from "@app/format";
import Checkbox from "@base/Checkbox";
import IconButton from "@base/IconButton";
import IconLink from "@base/IconLink";
import InitialIcon from "@base/InitialIcon";
import RelativeTime from "@base/RelativeTime";
import type { UserNested } from "@virtool/contracts";
import { Download, Trash } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useDeleteFile } from "../queries";

export type UploadItemProps = {
	/** An extra control shown beside the remove button. */
	action?: ReactNode;
	canDelete: boolean;
	/** Whether the file is selected. */
	checked?: boolean;

	/** When the file was created, or null for a row that predates the column */
	createdAt: Date | null;

	id: number;
	name: string;
	/** Selects the file. Omitting it hides the checkbox. */
	onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
	size: number;

	user: UserNested | null;
};

/**
 * A file in the upload table.
 *
 * A file with no user was retrieved by Virtool rather than uploaded by anyone,
 * so its user cell says so instead of naming an account.
 */
export default function UploadItem({
	action,
	canDelete,
	checked = false,
	createdAt,
	id,
	name,
	onSelect,
	size,
	user,
}: UploadItemProps) {
	const { mutate: handleRemove } = useDeleteFile();

	return (
		<tr>
			{onSelect && (
				<td className="w-px">
					<Checkbox
						ariaLabel={`Select ${name}`}
						checked={checked}
						id={`UploadCheckbox${id}`}
						onClick={onSelect}
					/>
				</td>
			)}
			<td className="font-medium">{name}</td>
			<td>
				{user === null ? (
					"Retrieved"
				) : (
					<span className="inline-flex items-center gap-2">
						{/* Decorative: the handle it draws is already the cell's text, and
						    `InitialIcon` labels itself with it. */}
						<span aria-hidden>
							<InitialIcon size="md" handle={user.handle} />
						</span>
						{user.handle}
					</span>
				)}
			</td>
			<td className="whitespace-nowrap">
				<RelativeTime time={createdAt} />
			</td>
			<td className="whitespace-nowrap">{byteSize(size, true)}</td>
			<td className="w-px">
				<span className="flex items-center gap-1 justify-end">
					{action}
					<IconLink
						ariaLabel={`Download ${name}`}
						color="gray"
						download={name}
						href={`/uploads/${id}`}
						IconComponent={Download}
						tip="download"
					/>
					{canDelete && (
						<IconButton
							color="red"
							IconComponent={Trash}
							tip="remove"
							onClick={() => handleRemove({ id })}
						/>
					)}
				</span>
			</td>
		</tr>
	);
}
