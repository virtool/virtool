import { cn } from "@app/cn";
import Badge from "@base/Badge";
import { BoxGroupSection } from "@base/Box";
import { Collapsible, CollapsibleContent } from "@base/Collapsible";
import Icon from "@base/Icon";
import ScrollArea from "@base/ScrollArea";
import { ChevronDown } from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { useState } from "react";
import SequenceButtons from "./SequenceButtons";
import {
	SEQUENCE_CHEVRON_COLUMN,
	SequenceAccessionValue,
	SequenceDefinitionValue,
	SequenceSegmentValue,
} from "./SequenceValues";

type GenomeSequenceProps = {
	accession: string;
	definition: string;
	host: string;
	id: string;
	onEdit: () => void;
	onDelete: () => void;
	segment?: string | null;
	sequence: string;
};

/**
 * A condensed genome sequence item for use in a list of sequences
 */
export default function Sequence({
	accession,
	definition,
	host,
	id,
	onEdit,
	onDelete,
	segment,
	sequence,
}: GenomeSequenceProps) {
	const [open, setOpen] = useState(false);

	return (
		<BoxGroupSection className="p-0">
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsiblePrimitive.Trigger
					className={cn(
						"group",
						"flex items-start w-full text-left",
						"bg-transparent border-none text-inherit",
						"px-6 py-3",
						"cursor-pointer hover:bg-gray-50",
						"focus-visible:outline-none",
						"focus-visible:ring-2",
						"focus-visible:ring-inset",
						"focus-visible:ring-blue-600/50",
					)}
				>
					<span className={SEQUENCE_CHEVRON_COLUMN}>
						<Icon
							className={cn(
								"size-4",
								"mt-1",
								"text-gray-600",
								"transition-transform",
								"group-data-[state=open]:rotate-180",
							)}
							icon={ChevronDown}
						/>
					</span>
					<SequenceAccessionValue accession={accession} />
					<SequenceSegmentValue segment={segment} />
					<SequenceDefinitionValue definition={definition} />
				</CollapsiblePrimitive.Trigger>
				<CollapsibleContent className="px-6 pb-3">
					<div className="mt-2.5 overflow-hidden rounded-md border border-gray-200 bg-white">
						<SequenceButtons id={id} onEdit={onEdit} onDelete={onDelete} />
						<div className="flex gap-3 border-b border-gray-200 px-3 py-2">
							<span className="w-20 shrink-0 font-semibold">Host</span>
							<span className="min-w-0 truncate">{host}</span>
						</div>
						<div className="flex items-center gap-2 px-3 pt-2 font-semibold">
							Sequence <Badge>{sequence.length}</Badge>
						</div>
						<ScrollArea className="mr-0 h-52 w-full rounded-none border-none">
							<p className="break-all p-3 font-mono">{sequence}</p>
						</ScrollArea>
					</div>
				</CollapsibleContent>
			</Collapsible>
		</BoxGroupSection>
	);
}
