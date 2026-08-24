import { useSuspenseSettings } from "@administration/queries";
import { ContainerNarrow } from "@base/Container";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import { GlobalSourceTypes } from "./SourceTypes/GlobalSourceTypes";

export default function ReferenceSettings() {
	const { data } = useSuspenseSettings();

	return (
		<ContainerNarrow>
			<ViewHeader title="Reference Settings">
				<ViewHeaderTitle>Settings</ViewHeaderTitle>
			</ViewHeader>
			<GlobalSourceTypes sourceTypes={data.defaultSourceTypes} />
		</ContainerNarrow>
	);
}
