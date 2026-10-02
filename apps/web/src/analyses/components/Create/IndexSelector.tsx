import { cn } from "@app/cn";
import Box from "@base/Box";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import { FieldLabel } from "@base/Field";
import Label from "@base/Label";
import Select, {
	SelectButton,
	SelectContent,
	SelectItemIndicator,
} from "@base/Select";
import { selectItemStateClasses } from "@base/styles";
import type { IndexMinimal } from "@virtool/contracts";
import { sortBy } from "es-toolkit";
import { ChevronDown, Library } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import CreateAnalysisFieldTitle from "./CreateAnalysisFieldTitle";

type IndexSelectorItemProps = {
	id: number;
	name: string;
	version: number | string;
};

function IndexSelectorItem({ id, name, version }: IndexSelectorItemProps) {
	return (
		<SelectPrimitive.Item
			className={cn(
				"capitalize",
				"flex",
				"items-center",
				"justify-between",
				"gap-2",
				"py-1.5",
				"px-6",
				"text-base",
				selectItemStateClasses,
			)}
			data-slot="select-item"
			key={id}
			// A Radix Select only matches string values, but index ids are
			// integers, so the value is stringified here and read back as a
			// string in the form.
			value={String(id)}
		>
			<SelectItemIndicator />
			<SelectPrimitive.ItemText className="whitespace-nowrap">
				{name}
			</SelectPrimitive.ItemText>
			<span>
				Index Version <Label>{version}</Label>
			</span>
		</SelectPrimitive.Item>
	);
}

type IndexSelectorProps = {
	indexes: IndexMinimal[];
	selected: string;
	onChange: (value: string) => void;
};

/**
 * A list of indexes available for analysis creation
 */
export default function IndexSelector({
	indexes,
	selected,
	onChange,
}: IndexSelectorProps) {
	const sortedIndexes = sortBy(indexes, [(index) => index.reference.name]);

	const indexItems = sortedIndexes.map(({ reference, version, id }) => (
		<IndexSelectorItem
			key={id}
			id={id}
			name={reference.name}
			version={version}
		/>
	));

	return (
		<div>
			{indexes.length ? (
				<>
					<FieldLabel className="mb-2.5 text-base font-normal">
						Reference
					</FieldLabel>
					<Select value={selected} onValueChange={onChange}>
						<SelectButton
							className={cn("flex", "w-full")}
							placeholder="Select a reference"
							icon={ChevronDown}
						/>
						<SelectContent>{indexItems}</SelectContent>
					</Select>
				</>
			) : (
				<>
					<CreateAnalysisFieldTitle>Reference</CreateAnalysisFieldTitle>
					<Box className="mb-0">
						<Empty className="py-12">
							<EmptyMedia className="text-gray-400">
								<Library size={40} strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No references found</EmptyTitle>
							<EmptyDescription>
								Build a reference index before running an analysis.
							</EmptyDescription>
						</Empty>
					</Box>
				</>
			)}
		</div>
	);
}
