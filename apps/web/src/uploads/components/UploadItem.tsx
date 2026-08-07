import { byteSize } from "@app/format";
import Attribution from "@base/Attribution";
import BoxGroupSection from "@base/BoxGroupSection";
import Checkbox from "@base/Checkbox";
import IconButton from "@base/IconButton";
import IconLink from "@base/IconLink";
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
	id: number;
	name: string;
	/** Selects the file. Omitting it hides the checkbox. */
	onSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
	size: number;

	/** When the file was uploaded, or null for a row that predates the column */
	uploadedAt: Date | null;

	user: UserNested | null;
};

export default function UploadItem({
	action,
	canDelete,
	checked = false,
	id,
	name,
	onSelect,
	size,
	uploadedAt,
	user,
}: UploadItemProps) {
	const { mutate: handleRemove } = useDeleteFile();

	return (
		<BoxGroupSection as="li">
			<div className="flex items-center gap-4">
				{onSelect && (
					<Checkbox
						ariaLabel={`Select ${name}`}
						checked={checked}
						id={`UploadCheckbox${id}`}
						onClick={onSelect}
					/>
				)}
				<div className="grid grid-cols-3 grow min-w-0">
					<div className="flex font-medium items-center text-lg">{name}</div>
					<div className="flex">
						{user === null ? (
							<span>
								Retrieved <RelativeTime time={uploadedAt} />
							</span>
						) : (
							<Attribution
								time={uploadedAt}
								user={user.handle}
								verb="uploaded"
							/>
						)}
					</div>
					<div className="flex font-medium items-center gap-6 justify-end text-lg">
						<div>{byteSize(size, true)}</div>
						<span className="flex items-center gap-1">
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
					</div>
				</div>
			</div>
		</BoxGroupSection>
	);
}
