import { cn } from "@app/cn";
import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { inputBaseClasses, inputHeightClass } from "@base/styles";
import TextArea from "@base/TextArea";
import { useCreateLocalOtu } from "@otus-v2/queries";
import { useNavigate } from "@tanstack/react-router";
import {
	type CreateLocalOtuCommandInput,
	OtuV2IsolateNameType,
	OtuV2MoleculeType,
	OtuV2SegmentRule,
	OtuV2Strandedness,
	OtuV2Topology,
} from "@virtool/contracts";
import { useId } from "react";
import { useForm } from "react-hook-form";

type FormValues = {
	taxonomyName: string;
	acronym: string;
	moleculeType: string;
	strandedness: string;
	topology: string;
	segmentLengthTolerance: number;
	segmentRule: string;
	isolateNameType: string;
	isolateNameValue: string;
	sequenceDefinition: string;
	sequence: string;
};

const selectClasses = cn(inputBaseClasses, inputHeightClass);

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

	const ids = {
		taxonomyName: useId(),
		acronym: useId(),
		moleculeType: useId(),
		strandedness: useId(),
		topology: useId(),
		segmentLengthTolerance: useId(),
		segmentRule: useId(),
		isolateNameType: useId(),
		isolateNameValue: useId(),
		sequenceDefinition: useId(),
		sequence: useId(),
	};

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({
		defaultValues: {
			taxonomyName: "",
			acronym: "",
			moleculeType: OtuV2MoleculeType.RNA,
			strandedness: OtuV2Strandedness.single,
			topology: OtuV2Topology.linear,
			segmentLengthTolerance: defaultSegmentLengthTolerance,
			segmentRule: OtuV2SegmentRule.required,
			isolateNameType: OtuV2IsolateNameType.isolate,
			isolateNameValue: "",
			sequenceDefinition: "",
			sequence: "",
		},
	});

	function onSubmit(values: FormValues) {
		const segmentId = crypto.randomUUID();
		const acronym = values.acronym.trim();
		const isolateNameValue = values.isolateNameValue.trim();
		const segmentLength = values.sequence.replace(/\s/g, "").length;

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
					segments: [
						{
							id: segmentId,
							name: null,
							length: segmentLength,
							lengthTolerance: values.segmentLengthTolerance,
							rule: values.segmentRule as OtuV2SegmentRule,
						},
					],
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
					sequences: [
						{
							id: crypto.randomUUID(),
							definition: values.sequenceDefinition,
							sequence: values.sequence,
							segmentId,
						},
					],
				},
			},
		};

		mutation.mutate(command, {
			onSuccess: (otu) => {
				navigate({
					to: "/refs/beta/$referenceId/otus/$otuId",
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

			<InputGroup>
				<InputLabel htmlFor={ids.segmentLengthTolerance}>
					Segment length tolerance
				</InputLabel>
				<InputSimple
					id={ids.segmentLengthTolerance}
					type="number"
					step="0.01"
					min={0}
					max={1}
					{...register("segmentLengthTolerance", { valueAsNumber: true })}
				/>
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={ids.segmentRule}>Segment rule</InputLabel>
				<select
					id={ids.segmentRule}
					className={selectClasses}
					{...register("segmentRule")}
				>
					<Options values={Object.values(OtuV2SegmentRule)} />
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
						<Options values={Object.values(OtuV2IsolateNameType)} />
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

			<InputGroup>
				<InputLabel htmlFor={ids.sequenceDefinition}>
					Sequence definition
				</InputLabel>
				<InputSimple
					id={ids.sequenceDefinition}
					aria-required
					aria-invalid={Boolean(errors.sequenceDefinition) || undefined}
					{...register("sequenceDefinition", { required: "Required Field" })}
				/>
				<InputError>{errors.sequenceDefinition?.message}</InputError>
			</InputGroup>

			<InputGroup>
				<InputLabel htmlFor={ids.sequence}>Sequence</InputLabel>
				<TextArea
					id={ids.sequence}
					aria-required
					aria-invalid={Boolean(errors.sequence) || undefined}
					{...register("sequence", { required: "Required Field" })}
				/>
				<InputError>{errors.sequence?.message}</InputError>
			</InputGroup>

			{mutation.isError && <InputError>{mutation.error.message}</InputError>}

			<Button color="blue" type="submit" disabled={mutation.isPending}>
				Create
			</Button>
		</form>
	);
}
