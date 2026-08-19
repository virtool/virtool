import { useCompatibleIndexes, useSubtractionOptions } from "@analyses/hooks";
import { useCreateAnalysis } from "@analyses/queries";
import Button from "@base/Button";
import CreatedCount from "@base/CreatedCount";
import { DialogFooter } from "@base/Dialog";
import InputError from "@base/InputError";
import QueryError from "@base/QueryError";
import Switch from "@base/Switch";
import SubtractionSelector from "@subtraction/components/SubtractionSelector";
import type { AnalysisWorkflow } from "@virtool/contracts";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CreateAnalysisSummary } from "./CreateAnalysisSummary";
import IndexSelector from "./IndexSelector";
import WorkflowSelector from "./WorkflowSelector";
import type { workflow } from "./workflows";

type CreateAnalysisFormValues = {
	indexId: string;
	subtractionIds: number[];
	workflow: AnalysisWorkflow;
};

type CreateAnalysisFormProps = {
	/** The workflows compatible with the selected sample(s) */
	compatibleWorkflows: workflow[];

	/** Closes the enclosing dialog. */
	onClose: () => void;

	/** The number of samples selected */
	sampleCount: number;

	/** The ids of the samples being analyzed */
	sampleIds: number[];
};

/**
 * Form for creating an analysis. The subtraction and reference inputs are
 * shared across every workflow, so the workflow is picked with a radio group
 * rather than switching between separate forms.
 */
export default function CreateAnalysisForm({
	compatibleWorkflows,
	onClose,
	sampleCount,
	sampleIds,
}: CreateAnalysisFormProps) {
	const {
		indexes,
		isPending: isPendingIndexes,
		isError: isErrorIndexes,
	} = useCompatibleIndexes();

	const {
		defaultSubtractions,
		subtractions,
		isPending: isPendingSubtractions,
		isError: isErrorSubtractions,
	} = useSubtractionOptions(sampleIds);

	const createAnalysis = useCreateAnalysis();

	const defaultValues = {
		indexId: "",
		subtractionIds: defaultSubtractions.map((subtraction) => subtraction.id),
		workflow: compatibleWorkflows[0]?.id,
	};

	const {
		control,
		handleSubmit,
		formState: { errors },
		reset,
		watch,
	} = useForm<CreateAnalysisFormValues>({ defaultValues });

	const [createMore, setCreateMore] = useState(false);
	const [createdCount, setCreatedCount] = useState(0);

	if (isErrorIndexes || isErrorSubtractions) {
		return <QueryError noun="analysis options" />;
	}

	if (isPendingIndexes || isPendingSubtractions) {
		return null;
	}

	async function onSubmit(values: CreateAnalysisFormValues) {
		const { indexId, subtractionIds, workflow } = values;

		const index = indexes.find((index) => String(index.id) === indexId);
		if (!index) {
			return;
		}
		const refId = index.reference.id;

		let created: Awaited<ReturnType<typeof createAnalysis.mutateAsync>>[];
		try {
			created = await Promise.all(
				sampleIds.map((sampleId) =>
					createAnalysis.mutateAsync({
						refId,
						sampleId,
						subtractionIds,
						workflow,
					}),
				),
			);
		} catch {
			return;
		}

		if (!createMore) {
			onClose();
			return;
		}

		reset(defaultValues);
		setCreatedCount((count) => count + created.length);
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			{compatibleWorkflows.length > 1 && (
				<Controller
					control={control}
					name="workflow"
					render={({ field: { onChange, value } }) => (
						<WorkflowSelector
							workflows={compatibleWorkflows}
							selected={value}
							onChange={onChange}
						/>
					)}
				/>
			)}

			<Controller
				control={control}
				name="subtractionIds"
				render={({ field: { onChange, value } }) => (
					<SubtractionSelector
						subtractions={subtractions}
						selected={value}
						onChange={onChange}
					/>
				)}
			/>

			<Controller
				control={control}
				name="indexId"
				render={({ field: { onChange, value } }) => (
					<IndexSelector
						indexes={indexes}
						selected={value}
						onChange={onChange}
						invalid={Boolean(errors.indexId)}
						describedById={errors.indexId ? "indexId-error" : undefined}
					/>
				)}
				rules={{ required: true }}
			/>

			<InputError id="indexId-error" className="mb-0">
				{errors.indexId && "A reference must be selected"}
			</InputError>

			<DialogFooter className="items-center justify-between">
				<div className="flex items-center gap-2">
					<Switch
						id="create-more"
						checked={createMore}
						onCheckedChange={setCreateMore}
					/>
					<label
						className="cursor-pointer text-gray-700 text-sm"
						htmlFor="create-more"
					>
						Create more
					</label>
				</div>

				<div className="flex items-center gap-4">
					<CreatedCount
						count={createdCount}
						onExpire={() => setCreatedCount(0)}
						plural="analyses"
						singular="analysis"
					/>
					<CreateAnalysisSummary
						sampleCount={sampleCount}
						indexCount={watch("indexId") ? 1 : 0}
					/>
					<Button type="submit" color="blue">
						Create
					</Button>
				</div>
			</DialogFooter>
		</form>
	);
}
