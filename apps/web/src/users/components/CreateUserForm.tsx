import Checkbox from "@base/Checkbox";
import Field, {
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import type { AdministratorRoleName, GroupMinimal } from "@virtool/contracts";
import { Controller, useForm } from "react-hook-form";
import {
	type DeliveryIntent,
	DeliveryIntentField,
} from "./DeliveryIntentField";

/** Values collected when an administrator invites a user. */
export type CreateUserFormValues = {
	email: string;
	deliveryIntent: DeliveryIntent;
	administratorRole: AdministratorRoleName | null;
	groups: number[];
	primaryGroup: number | null;
};

/** Form state, where a null delivery intent means none was chosen yet. */
type CreateUserFormState = Omit<CreateUserFormValues, "deliveryIntent"> & {
	deliveryIntent: DeliveryIntent | null;
};

type CreateUserFormProps = {
	error: string;
	onSubmit: (data: CreateUserFormValues) => void;
	groups: GroupMinimal[];
	roles: Array<{ id: AdministratorRoleName; name: string }>;
	canAssignAdministratorRole: boolean;
	canConfigureEmailDelivery: boolean;
	emailDeliveryAvailable: boolean;
};

/** Form for creating a pending user and issuing an invitation. */
export function CreateUserForm({
	error,
	onSubmit,
	groups,
	roles,
	canAssignAdministratorRole,
	canConfigureEmailDelivery,
	emailDeliveryAvailable,
}: CreateUserFormProps) {
	const {
		formState: { errors },
		register,
		handleSubmit,
		control,
		getValues,
		setValue,
		watch,
	} = useForm<CreateUserFormState>({
		defaultValues: {
			email: "",
			deliveryIntent: null,
			administratorRole: null,
			groups: [],
			primaryGroup: null,
		},
	});
	const selectedGroups = watch("groups");
	const defaultDeliveryIntent: DeliveryIntent = emailDeliveryAvailable
		? "email"
		: "copy_only";

	function submit(values: CreateUserFormState) {
		onSubmit({
			...values,
			deliveryIntent: values.deliveryIntent ?? defaultDeliveryIntent,
		});
	}

	return (
		<form onSubmit={handleSubmit(submit)}>
			{groups.length > 0 && (
				<>
					<FieldSet>
						<FieldLegend variant="label">Groups</FieldLegend>
						<Controller
							name="groups"
							control={control}
							render={({ field }) => (
								<div className="grid gap-2">
									{groups.map((group) => (
										<Checkbox
											key={group.id}
											id={`invite-group-${group.id}`}
											label={group.name}
											checked={field.value.includes(group.id)}
											onClick={() => {
												const removing = field.value.includes(group.id);
												field.onChange(
													removing
														? field.value.filter((id) => id !== group.id)
														: [...field.value, group.id],
												);
												if (
													removing &&
													getValues("primaryGroup") === group.id
												) {
													setValue("primaryGroup", null);
												}
											}}
										/>
									))}
								</div>
							)}
						/>
					</FieldSet>
					<Field>
						<FieldLabel htmlFor="primary-group">Primary group</FieldLabel>
						<Controller
							name="primaryGroup"
							control={control}
							render={({ field }) => (
								<select
									id="primary-group"
									value={field.value ?? ""}
									onChange={(event) =>
										field.onChange(
											event.target.value ? Number(event.target.value) : null,
										)
									}
								>
									<option value="">None</option>
									{groups
										.filter((group) => selectedGroups.includes(group.id))
										.map((group) => (
											<option key={group.id} value={group.id}>
												{group.name}
											</option>
										))}
								</select>
							)}
						/>
					</Field>
				</>
			)}
			<Field>
				<FieldLabel>Email</FieldLabel>
				<Input
					type="email"
					autoComplete="off"
					{...register("email", {
						required: "Please specify an email address",
					})}
				/>
				<FieldError
					errors={[errors.email, error ? { message: error } : undefined]}
				/>
			</Field>
			{canAssignAdministratorRole && (
				<Field>
					<FieldLabel htmlFor="administrator-role">
						Administrator role
					</FieldLabel>
					<Controller
						name="administratorRole"
						control={control}
						render={({ field }) => (
							<select
								className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900"
								id="administrator-role"
								value={field.value ?? ""}
								onChange={(event) => field.onChange(event.target.value || null)}
							>
								<option value="">None</option>
								{roles.map((role) => (
									<option key={role.id} value={role.id}>
										{role.name}
									</option>
								))}
							</select>
						)}
					/>
				</Field>
			)}
			<Controller
				name="deliveryIntent"
				control={control}
				render={({ field }) => (
					<DeliveryIntentField
						name={field.name}
						value={field.value ?? defaultDeliveryIntent}
						onChange={field.onChange}
						emailDeliveryAvailable={emailDeliveryAvailable}
						canConfigureEmailDelivery={canConfigureEmailDelivery}
					/>
				)}
			/>
			<div className="flex justify-end items-center mb-2.5">
				<SaveButton />
			</div>
		</form>
	);
}
