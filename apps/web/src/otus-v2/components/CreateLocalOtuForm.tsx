import { cn } from "@app/cn";
import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { inputBaseClasses, inputHeightClass } from "@base/styles";
import TextArea from "@base/TextArea";
import { getIsolateNameTypeLabel } from "@otus-v2/isolateName";
import { useCreateLocalOtu } from "@otus-v2/queries";
import { useNavigate } from "@tanstack/react-router";
import {
	CreateLocalOtuCommand,
	type CreateLocalOtuCommandInput,
	OtuV2IsolateNameType,
	OtuV2MoleculeType,
	OtuV2SegmentRule,
	OtuV2Strandedness,
	OtuV2Topology,
} from "@virtool/contracts";
import { useId, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

type SegmentFormValues = {
	namePrefix: string;
	nameKey: string;
	length: number;
	lengthTolerance: number;
	rule: string;
	sequenceDefinition: string;
	sequence: string;
};

type FormValues = {
	taxonomyName: string;
	acronym: string;
	moleculeType: string;
	strandedness: string;
	topology: string;
	isolateNameType: string;
	isolateNameValue: string;
	segments: SegmentFormValues[];
};

const selectClasses = cn(inputBaseClasses, inputHeightClass);

function newSegment(lengthTolerance: number): SegmentFormValues {
	return {
		namePrefix: "",
		nameKey: "",
		length: 0,
		lengthTolerance,
		rule: OtuV2SegmentRule.required,
		sequenceDefinition: "",
		sequence: "",
	};
}

function Options({ values }: { values: readonly string[] }) {
	return (
		<>
			{values.map((value) => (
				<option key={value} value={value}>
					{value}
				</option>
			))}
		</>
	);
}

/**
 * A form that assembles one complete local `CreateOTU` command.
 *
 * Every UUID is minted on submit and the whole command is sent at once, so the
 * server only ever receives a complete aggregate. Incomplete state stays here.
 */
export default function CreateLocalOtuForm({
	referenceId,
	defaultSegmentLengthTolerance,
}: {
	referenceId: string;
	defaultSegmentLengthTolerance: number;
}) {
	const navigate = useNavigate();
	const mutation = useCreateLocalOtu(referenceId);
	const [planError, setPlanError] = useState<string>();

	const ids = {
		taxonomyName: useId(),
		acronym: useId(),
		moleculeType: useId(),
		strandedness: useId(),
		topology: useId(),
		isolateNameType: useId(),
		isolateNameValue: useId(),
	};

	const {
		formState: { errors },
		handleSubmit,
		control,
		register,
	} = useForm<FormValues>({
		defaultValues: {
			taxonomyName: "",
			acronym: "",
			moleculeType: OtuV2MoleculeType.RNA,
			strandedness: OtuV2Strandedness.single,
			topology: OtuV2Topology.linear,
			isolateNameType: OtuV2IsolateNameType.isolate,
			isolateNameValue: "",
			segments: [newSegment(defaultSegmentLengthTolerance)],
		},
	});
	const { fields, append, remove } = useFieldArray({
		control,
		name: "segments",
	});

	function onSubmit(values: FormValues) {
		setPlanError(undefined);
		const acronym = values.acronym.trim();
		const isolateNameValue = values.isolateNameValue.trim();
		const segments = values.segments.map((segment) => {
			const id = crypto.randomUUID();
			return { id, segment };
		});

		const command: CreateLocalOtuCommandInput = {
			type: "CreateOTU",
			schemaVersion: 1,
			otuId: crypto.randomUUID(),
			expectedVersion: 0,
			payload: {
				molecule: {
					type: values.moleculeType as OtuV2MoleculeType,
					strandedness: values.strandedness as OtuV2Strandedness,
					topology: values.topology as OtuV2Topology,
				},
				plan: {
					id: crypto.randomUUID(),
					segments: segments.map(({ id, segment }) => ({
						id,
						name:
							segment.namePrefix.trim() || segment.nameKey.trim()
								? { prefix: segment.namePrefix, key: segment.nameKey }
								: null,
						length: segment.length,
						lengthTolerance: segment.lengthTolerance,
						rule: segment.rule as OtuV2SegmentRule,
					})),
				},
				taxonomy: {
					kind: "local",
					identityId: crypto.randomUUID(),
					name: values.taxonomyName,
					acronym: acronym === "" ? null : acronym,
				},
				promotedAccessions: [],
				isolate: {
					id: crypto.randomUUID(),
					name:
						isolateNameValue === ""
							? null
							: {
									type: values.isolateNameType as OtuV2IsolateNameType,
									value: isolateNameValue,
								},
					sequences: segments.map(({ id, segment }) => ({
						id: crypto.randomUUID(),
						definition: segment.sequenceDefinition,
						sequence: segment.sequence,
						segmentId: id,
					})),
				},
			},
		};

		const result = CreateLocalOtuCommand.safeParse(command);
		if (!result.success) {
			setPlanError(result.error.issues[0]?.message ?? "Invalid OTU plan.");
			return;
		}

		mutation.mutate(result.data, {
			onSuccess: (otu) => {
				navigate({
					to: "/refs/alpha/$referenceId/otus/$otuId",
					params: { referenceId, otuId: otu.id },
				});
			},
		});
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<InputGroup>
				<InputLabel htmlFor={ids.taxonomyName}>Name</InputLabel>
				<InputSimple
					id={ids.taxonomyName}
					aria-required
					aria-invalid={Boolean(errors.taxonomyName) || undefined}
					{...register("taxonomyName", { required: "Required Field" })}
				/>
				<InputError>{errors.taxonomyName?.message}</InputError>
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={ids.acronym}>Acronym</InputLabel>
				<InputSimple id={ids.acronym} {...register("acronym")} />
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={ids.moleculeType}>Molecule type</InputLabel>
				<select
					id={ids.moleculeType}
					className={selectClasses}
					{...register("moleculeType")}
				>
					<Options values={Object.values(OtuV2MoleculeType)} />
				</select>
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={ids.strandedness}>Strandedness</InputLabel>
				<select
					id={ids.strandedness}
					className={selectClasses}
					{...register("strandedness")}
				>
					<Options values={Object.values(OtuV2Strandedness)} />
				</select>
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={ids.topology}>Topology</InputLabel>
				<select
					id={ids.topology}
					className={selectClasses}
					{...register("topology")}
				>
					<Options values={Object.values(OtuV2Topology)} />
				</select>
			</InputGroup>

			<div className="grid grid-cols-2 gap-4">
				<InputGroup>
					<InputLabel htmlFor={ids.isolateNameType}>
						Isolate name type
					</InputLabel>
					<select
						id={ids.isolateNameType}
						className={selectClasses}
						{...register("isolateNameType")}
					>
						{Object.values(OtuV2IsolateNameType).map((type) => (
							<option key={type} value={type}>
								{getIsolateNameTypeLabel(type)}
							</option>
						))}
					</select>
				</InputGroup>

				<InputGroup>
					<InputLabel htmlFor={ids.isolateNameValue}>Isolate name</InputLabel>
					<InputSimple
						id={ids.isolateNameValue}
						{...register("isolateNameValue")}
					/>
				</InputGroup>
			</div>

			{fields.map((field, index) => (
				<fieldset
					key={field.id}
					className="rounded border border-slate-200 p-4"
				>
					<legend className="font-semibold">Segment {index + 1}</legend>
					<div className="grid grid-cols-2 gap-4">
						<InputGroup>
							<InputLabel htmlFor={`${field.id}-prefix`}>
								Segment {index + 1} name prefix
							</InputLabel>
							<InputSimple
								id={`${field.id}-prefix`}
								{...register(`segments.${index}.namePrefix`)}
							/>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor={`${field.id}-key`}>
								Segment {index + 1} name key
							</InputLabel>
							<InputSimple
								id={`${field.id}-key`}
								{...register(`segments.${index}.nameKey`)}
							/>
						</InputGroup>
					</div>
					<InputGroup>
						<InputLabel htmlFor={`${field.id}-length`}>
							Segment {index + 1} expected length
						</InputLabel>
						<InputSimple
							id={`${field.id}-length`}
							type="number"
							min={1}
							aria-required
							aria-invalid={
								Boolean(errors.segments?.[index]?.length) || undefined
							}
							{...register(`segments.${index}.length`, {
								valueAsNumber: true,
								min: { value: 1, message: "Expected length must be positive." },
							})}
						/>
						<InputError>{errors.segments?.[index]?.length?.message}</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor={`${field.id}-tolerance`}>
							Segment {index + 1} length tolerance
						</InputLabel>
						<InputSimple
							id={`${field.id}-tolerance`}
							type="number"
							step="0.01"
							min={0}
							max={1}
							{...register(`segments.${index}.lengthTolerance`, {
								valueAsNumber: true,
							})}
						/>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor={`${field.id}-rule`}>
							Segment {index + 1} rule
						</InputLabel>
						<select
							id={`${field.id}-rule`}
							className={selectClasses}
							{...register(`segments.${index}.rule`)}
						>
							<Options values={Object.values(OtuV2SegmentRule)} />
						</select>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor={`${field.id}-definition`}>
							Segment {index + 1} sequence definition
						</InputLabel>
						<InputSimple
							id={`${field.id}-definition`}
							aria-required
							aria-invalid={
								Boolean(errors.segments?.[index]?.sequenceDefinition) ||
								undefined
							}
							{...register(`segments.${index}.sequenceDefinition`, {
								required: "Required Field",
							})}
						/>
						<InputError>
							{errors.segments?.[index]?.sequenceDefinition?.message}
						</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor={`${field.id}-sequence`}>
							Segment {index + 1} sequence
						</InputLabel>
						<TextArea
							id={`${field.id}-sequence`}
							aria-required
							aria-invalid={
								Boolean(errors.segments?.[index]?.sequence) || undefined
							}
							{...register(`segments.${index}.sequence`, {
								required: "Required Field",
							})}
						/>
						<InputError>
							{errors.segments?.[index]?.sequence?.message}
						</InputError>
					</InputGroup>
					{fields.length > 1 && (
						<Button type="button" color="red" onClick={() => remove(index)}>
							Remove segment {index + 1}
						</Button>
					)}
				</fieldset>
			))}
			<Button
				type="button"
				color="gray"
				onClick={() => append(newSegment(defaultSegmentLengthTolerance))}
			>
				Add segment
			</Button>

			{planError && <InputError>{planError}</InputError>}
			{mutation.isError && <InputError>{mutation.error.message}</InputError>}

			<Button color="blue" type="submit" disabled={mutation.isPending}>
				Create
			</Button>
		</form>
	);
}
