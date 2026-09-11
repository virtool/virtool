import { cn } from "@app/cn";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import { InputGroup, InputLabel, InputSimple } from "@base/Input";
import type { GroupMinimal, Label } from "@virtool/contracts";
import { useState } from "react";
import DefaultSubtractionSelector from "./DefaultSubtractionSelector";
import LabelSelector from "./LabelSelector";
import LibraryTypeSelector from "./LibraryTypeSelector";
import SampleUserGroup from "./SampleUserGroup";
import type { SampleSettingsValues } from "./settings";

type SampleSettingsFieldsProps = {
	groups: GroupMinimal[];
	labels: Label[];
	metadataColumns?: 2 | 3;
	onShowMetadataChange?: (showMetadata: boolean) => void;
	showMetadata?: boolean;
	value: SampleSettingsValues;
	onChange: (value: SampleSettingsValues) => void;
};

export default function SampleSettingsFields({
	groups,
	labels,
	metadataColumns = 3,
	onShowMetadataChange,
	showMetadata,
	value,
	onChange,
}: SampleSettingsFieldsProps) {
	const [internalShowMetadata, setInternalShowMetadata] = useState(false);
	const isShowingMetadata = showMetadata ?? internalShowMetadata;
	const handleShowMetadataChange =
		onShowMetadataChange ?? setInternalShowMetadata;
	return (
		<>
			<SampleUserGroup
				selected={value.group}
				groups={groups}
				onChange={(next) => onChange({ ...value, group: next })}
			/>

			<Collapsible
				className="mb-4"
				open={isShowingMetadata}
				onOpenChange={handleShowMetadataChange}
			>
				<CollapsibleTrigger>Show Metadata Fields</CollapsibleTrigger>
				<CollapsibleContent
					className={cn(
						"grid gap-x-4 pt-4",
						metadataColumns === 2 ? "grid-cols-2" : "grid-cols-3",
					)}
				>
					<InputGroup>
						<InputLabel htmlFor="locale">Locale</InputLabel>
						<InputSimple
							id="locale"
							value={value.locale}
							onChange={(event) =>
								onChange({ ...value, locale: event.target.value })
							}
						/>
					</InputGroup>

					<InputGroup>
						<InputLabel htmlFor="isolate">Isolate</InputLabel>
						<InputSimple
							id="isolate"
							value={value.isolate}
							onChange={(event) =>
								onChange({ ...value, isolate: event.target.value })
							}
						/>
					</InputGroup>

					<InputGroup>
						<InputLabel htmlFor="host">Host</InputLabel>
						<InputSimple
							id="host"
							value={value.host}
							onChange={(event) =>
								onChange({ ...value, host: event.target.value })
							}
						/>
					</InputGroup>
				</CollapsibleContent>
			</Collapsible>

			<LibraryTypeSelector
				libraryType={value.libraryType}
				onSelect={(next) => onChange({ ...value, libraryType: next })}
			/>

			<LabelSelector
				labels={labels}
				selected={value.labels}
				onChange={(next) => onChange({ ...value, labels: next })}
			/>

			<DefaultSubtractionSelector
				selected={value.subtractionIds}
				onChange={(next) => onChange({ ...value, subtractionIds: next })}
			/>
		</>
	);
}
