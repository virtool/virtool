import { formatIsolateName } from "@app/utils";
import Checkbox from "@base/Checkbox";
import Icon, { IconButton } from "@base/Icon";
import Link from "@base/Link";
import type { OtuIsolate } from "@virtool/contracts";
import { Star, Trash } from "lucide-react";
import type { MouseEvent } from "react";

type IsolateItemProps = {
	/** The isolate to display */
	isolate: OtuIsolate;
	/** The parent reference id */
	refId: string;
	/** The parent OTU id */
	otuId: string;
	/** Whether the delete control should be shown */
	canDelete: boolean;
	/** Called with the isolate when its delete control is clicked */
	onDelete: (isolate: OtuIsolate) => void;
	/** Called when the selection checkbox is clicked */
	onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
	/** Whether the isolate is selected for export */
	selected: boolean;
};

/**
 * A condensed isolate item for use in a list of isolates
 */
export default function IsolateItem({
	isolate,
	refId,
	otuId,
	canDelete,
	onDelete,
	onSelect,
	selected,
}: IsolateItemProps) {
	return (
		<div className="flex items-center h-full border-b border-gray-100 pl-6 pr-2 hover:bg-gray-50">
			<Checkbox
				ariaLabel={`Select ${formatIsolateName(isolate)}`}
				checked={selected}
				onClick={onSelect}
			/>
			<Link
				to="/refs/$refId/otus/$otuId/isolates/$isolateId"
				params={{ refId, otuId, isolateId: isolate.id }}
				className="flex flex-1 items-center min-w-0 h-full py-3 px-4 text-inherit"
			>
				<span className="truncate font-medium">
					{formatIsolateName(isolate)}
				</span>
				{isolate.default && <Icon icon={Star} className="ml-2" />}
			</Link>
			{canDelete && (
				<IconButton
					IconComponent={Trash}
					ariaLabel="Delete isolate"
					color="red"
					tip="Delete"
					onClick={() => onDelete(isolate)}
				/>
			)}
		</div>
	);
}
