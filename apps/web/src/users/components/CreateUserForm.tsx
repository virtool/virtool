import Field, {
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import Select, { SelectButton, SelectContent, SelectItem } from "@base/Select";
import type { AdministratorRoleName, GroupMinimal } from "@virtool/contracts";
import { ChevronDown } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import {
	type DeliveryIntent,
	DeliveryIntentField,
} from "./DeliveryIntentField";
import GroupMembershipField from "./GroupMembershipField";

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
	const primaryGroup = watch("primaryGroup");
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
			{groups.length > 0 && (
				<FieldSet>
					<FieldLegend variant="label">Groups</FieldLegend>
					<GroupMembershipField
						groups={groups}
						memberGroups={groups.filter((group) =>
							selectedGroups.includes(group.id),
						)}
						primaryGroupId={primaryGroup}
						onAdd={(id) => setValue("groups", [...selectedGroups, id])}
						onRemove={(id) => {
							setValue(
								"groups",
								selectedGroups.filter((groupId) => groupId !== id),
							);
							if (primaryGroup === id) {
								setValue("primaryGroup", null);
							}
						}}
						onPrimaryGroupChange={(id) => setValue("primaryGroup", id)}
					/>
				</FieldSet>
			)}
			{canAssignAdministratorRole && (
				<Field>
					<FieldLabel>Administrator role</FieldLabel>
					<Controller
						name="administratorRole"
						control={control}
						render={({ field }) => (
							<Select
								value={field.value ?? "none"}
								onValueChange={(value) =>
									field.onChange(
										roles.find((role) => role.id === value)?.id ?? null,
									)
								}
							>
								<SelectButton className="w-full" icon={ChevronDown} />
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{roles.map((role) => (
										<SelectItem key={role.id} value={role.id}>
											{role.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
