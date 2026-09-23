import Button from "@base/Button";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { useUpdateLocalOtuTaxonomy } from "@otus-v2/queries";
import { useCanModifyReferenceV2Otus } from "@references-v2/hooks";
import type { LocalOtuV2Overview } from "@virtool/contracts";
import { useId, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

type FormValues = {
	name: string;
	acronym: string;
	lineage: Array<{ id: number; name: string; rank: string }>;
};

/** Edit the local display identity and NCBI lineage of an OTU. */
export default function EditLocalOtuTaxonomy({
	referenceId,
	otu,
}: {
	referenceId: string;
	otu: LocalOtuV2Overview;
}) {
	const canModify = useCanModifyReferenceV2Otus(referenceId);
	const [open, setOpen] = useState(false);
	const mutation = useUpdateLocalOtuTaxonomy(referenceId);
	const nameId = useId();
	const acronymId = useId();
	const {
		register,
		handleSubmit,
		control,
		formState: { errors },
	} = useForm<FormValues>({
		values: {
			name: otu.taxonomy.name,
			acronym: otu.taxonomy.acronym ?? "",
			lineage: otu.taxonomy.lineage,
		},
	});
	const { fields, append, remove } = useFieldArray({
		control,
		name: "lineage",
	});

	function onSubmit(values: FormValues) {
		mutation.mutate(
			{
				type: "UpdateTaxonomy",
				schemaVersion: 1,
				otuId: otu.id,
				expectedVersion: otu.version,
				payload: {
					name: values.name,
					acronym: values.acronym.trim() || null,
					lineage: values.lineage,
				},
			},
			{ onSuccess: () => setOpen(false) },
		);
	}

	return (
		<>
			{canModify && (
				<Button color="gray" onClick={() => setOpen(true)}>
					Edit taxonomy
				</Button>
			)}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent size="lg">
					<DialogTitle>Edit taxonomy</DialogTitle>
					<form onSubmit={handleSubmit(onSubmit)}>
						<InputGroup>
							<InputLabel htmlFor={nameId}>Taxonomy name</InputLabel>
							<InputSimple
								id={nameId}
								aria-required
								aria-invalid={Boolean(errors.name) || undefined}
								{...register("name", { required: "Required Field" })}
							/>
							<InputError>{errors.name?.message}</InputError>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor={acronymId}>Acronym</InputLabel>
							<InputSimple id={acronymId} {...register("acronym")} />
						</InputGroup>
						<p className="mb-3 text-sm text-slate-600">
							Enter lineage from higher taxa to the organism. A matching species
							taxon ID allows GenBank isolates to be added.
						</p>
						{fields.map((field, index) => (
							<fieldset
								key={field.id}
								className="mb-3 rounded border border-slate-200 p-3"
							>
								<legend className="font-semibold">Taxon {index + 1}</legend>
								<div className="grid grid-cols-3 gap-3">
									<InputGroup>
										<InputLabel htmlFor={`${field.id}-id`}>
											Taxon {index + 1} NCBI ID
										</InputLabel>
										<InputSimple
											id={`${field.id}-id`}
											type="number"
											min={1}
											{...register(`lineage.${index}.id`, {
												valueAsNumber: true,
												required: "Required Field",
											})}
										/>
										<InputError>
											{errors.lineage?.[index]?.id?.message}
										</InputError>
									</InputGroup>
									<InputGroup>
										<InputLabel htmlFor={`${field.id}-rank`}>
											Taxon {index + 1} rank
										</InputLabel>
										<InputSimple
											id={`${field.id}-rank`}
											placeholder="species"
											{...register(`lineage.${index}.rank`, {
												required: "Required Field",
											})}
										/>
										<InputError>
											{errors.lineage?.[index]?.rank?.message}
										</InputError>
									</InputGroup>
									<InputGroup>
										<InputLabel htmlFor={`${field.id}-name`}>
											Taxon {index + 1} name
										</InputLabel>
										<InputSimple
											id={`${field.id}-name`}
											{...register(`lineage.${index}.name`, {
												required: "Required Field",
											})}
										/>
										<InputError>
											{errors.lineage?.[index]?.name?.message}
										</InputError>
									</InputGroup>
								</div>
								<Button type="button" color="red" onClick={() => remove(index)}>
									Remove taxon {index + 1}
								</Button>
							</fieldset>
						))}
						<Button
							type="button"
							color="gray"
							onClick={() => append({ id: 0, rank: "species", name: "" })}
						>
							Add taxon
						</Button>
						{mutation.isError && (
							<InputError>{mutation.error.message}</InputError>
						)}
						<div className="mt-4">
							<Button type="submit" color="blue" disabled={mutation.isPending}>
								Save taxonomy
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
