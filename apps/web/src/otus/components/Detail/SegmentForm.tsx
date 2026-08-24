import Checkbox from "@base/Checkbox";
import { DialogFooter } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
import { Molecule, type OtuSegment } from "@virtool/contracts";
import { ChevronDown } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

const moleculeTypes = [
	"",
	Molecule.ss_dna,
	Molecule.ds_dna,
	Molecule.ss_rna_pos,
	Molecule.ss_rna_neg,
	Molecule.ss_rna,
	Molecule.ds_rna,
];

type FormValues = {
	segmentName: string;
	molecule: Molecule | "";
	required: boolean;
};

type SegmentFormProps = {
	segmentName?: string;
	molecule?: Molecule | null;
	required?: boolean;
	/** A callback function to be called when the form is submitted */
	onSubmit: (values: FormValues) => void;
	/** The segments associated with the otu */
	schema: OtuSegment[];
};

/**
 * Form for creating a segment
 */
export default function SegmentForm({
	segmentName,
	molecule,
	required,
	onSubmit,
	schema,
}: SegmentFormProps) {
	const {
		formState: { errors },
		control,
		register,
		handleSubmit,
	} = useForm<FormValues>({
		defaultValues: {
			segmentName: segmentName || "",
			molecule: molecule || "",
			required: required !== false,
		},
	});

	return (
		<form onSubmit={handleSubmit((values) => onSubmit({ ...values }))}>
			<div className="grid gap-4" style={{ gridTemplateColumns: "3fr 1fr" }}>
				<InputGroup>
					<InputLabel htmlFor="name">Name</InputLabel>
					<InputSimple
						id="name"
						aria-required
						aria-invalid={Boolean(errors.segmentName) || undefined}
						aria-describedby={errors.segmentName ? "name-error" : undefined}
						{...register("segmentName", {
							required: "Name required",
							validate: (value) =>
								schema
									.filter((s) => s.name !== segmentName)
									.find((s) => s.name === value) &&
								"Segment names must be unique. This name is currently in use.",
						})}
					/>
					<InputError id="name-error">{errors.segmentName?.message}</InputError>
				</InputGroup>

				<InputGroup>
					<InputLabel htmlFor="molecule">Molecule Type</InputLabel>
					<Controller
						name="molecule"
						control={control}
						render={({ field: { onChange, value } }) => (
							<Select
								value={value || "none"}
								onValueChange={(value) =>
									onChange(value === "none" ? "" : value)
								}
							>
								<SelectButton
									className="w-full normal-case"
									icon={ChevronDown}
									id="molecule"
								/>
								<SelectContent>
									{moleculeTypes.map((molecule) => (
										<SelectItem
											className="normal-case"
											key={molecule || "none"}
											value={molecule || "none"}
										>
											{molecule || "None"}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					/>
				</InputGroup>

				<Controller
					name="required"
					control={control}
					render={({ field: { onChange, value } }) => (
						<Checkbox
							checked={value}
							id={`SegmentCheckbox-${segmentName}`}
							label="Required"
							onClick={() => onChange(!value)}
						/>
					)}
				/>

				<DialogFooter>
					<SaveButton />
				</DialogFooter>
			</div>
		</form>
	);
}
