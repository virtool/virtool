import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import ContainerNarrow from "@base/ContainerNarrow";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { Tags } from "lucide-react";
import {
	useCreateLabel,
	useDeleteLabel,
	useFetchLabels,
	useUpdateLabel,
} from "../queries";
import { CreateLabel } from "./CreateLabel";
import { LabelItem } from "./LabelItem";

/**
 * Display and manage a list of labels. Owns the label query and mutations
 * for the labels management page.
 */
export function Labels() {
	const { data, isPending, isError } = useFetchLabels();
	const createMutation = useCreateLabel();
	const updateMutation = useUpdateLabel();
	const deleteMutation = useDeleteLabel();

	if (isError && !data) {
		return <QueryError noun="labels" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	return (
		<ContainerNarrow>
			<ViewHeader className="flex items-center justify-between" title="Labels">
				<div>
					<ViewHeaderTitle>Labels</ViewHeaderTitle>
					<p className="text-gray-600 text-base font-medium mt-1">
						Use labels to organize samples.
					</p>
				</div>

				<CreateLabel
					onSubmit={(values) => createMutation.mutateAsync(values)}
				/>
			</ViewHeader>

			<BoxGroup>
				{data.length ? (
					data.map((label) => (
						<LabelItem
							key={label.id}
							color={label.color}
							description={label.description}
							id={label.id}
							name={label.name}
							onEdit={(labelId, values) =>
								updateMutation.mutateAsync({ labelId, ...values })
							}
							onDelete={(labelId) => deleteMutation.mutateAsync({ labelId })}
						/>
					))
				) : (
					<BoxGroupSection>
						<Empty className="h-72">
							<EmptyMedia className="text-gray-400">
								<Tags size={40} strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No labels found</EmptyTitle>
							<EmptyDescription>
								No labels have been created yet.
							</EmptyDescription>
						</Empty>
					</BoxGroupSection>
				)}
			</BoxGroup>
		</ContainerNarrow>
	);
}
