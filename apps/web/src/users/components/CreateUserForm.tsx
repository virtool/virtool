import Checkbox from "@base/Checkbox";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import type { AdministratorRoleName, GroupMinimal } from "@virtool/contracts";
import { Controller, useForm } from "react-hook-form";

/** Values collected when an administrator invites a user. */
export type CreateUserFormValues = {
	handle: string;
	email: string;
	deliveryIntent: "copy_only" | "email";
	administratorRole: AdministratorRoleName | null;
	groups: number[];
	primaryGroup: number | null;
};

type CreateUserFormProps = {
	error: string;
	onSubmit: (data: CreateUserFormValues) => void;
	groups: GroupMinimal[];
	roles: Array<{ id: AdministratorRoleName; name: string }>;
	canAssignAdministratorRole: boolean;
};

/** Form for creating a pending user and issuing an invitation. */
export function CreateUserForm({
	error,
	onSubmit,
	groups,
	roles,
	canAssignAdministratorRole,
}: CreateUserFormProps) {
	const {
		formState: { errors },
		register,
		handleSubmit,
		control,
		getValues,
		setValue,
		watch,
	} = useForm<CreateUserFormValues>({
		defaultValues: {
			handle: "",
			email: "",
			deliveryIntent: "email",
			administratorRole: null,
			groups: [],
			primaryGroup: null,
		},
	});
	const selectedGroups = watch("groups");

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<InputGroup>
				<InputLabel htmlFor="handle">Username</InputLabel>
				<InputSimple
					id="handle"
					autoComplete="off"
					aria-invalid={Boolean(errors.handle) || undefined}
					{...register("handle", { required: "Please specify a username" })}
				/>
				<InputError>{errors.handle?.message}</InputError>
			</InputGroup>
			{canAssignAdministratorRole && (
				<InputGroup>
					<InputLabel htmlFor="administrator-role">
						Administrator role
					</InputLabel>
					<Controller
						name="administratorRole"
						control={control}
						render={({ field }) => (
							<select
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
				</InputGroup>
			)}
			{groups.length > 0 && (
				<InputGroup>
					<InputLabel>Groups</InputLabel>
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
											if (removing && getValues("primaryGroup") === group.id) {
												setValue("primaryGroup", null);
											}
										}}
									/>
								))}
							</div>
						)}
					/>
					<InputLabel htmlFor="primary-group">Primary group</InputLabel>
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
				</InputGroup>
			)}
			<InputGroup>
				<InputLabel htmlFor="email">Email</InputLabel>
				<InputSimple
					id="email"
					type="email"
					autoComplete="off"
					aria-invalid={Boolean(errors.email) || undefined}
					{...register("email", {
						required: "Please specify an email address",
					})}
				/>
				<InputError>{errors.email?.message || error}</InputError>
			</InputGroup>
			<div className="flex justify-between items-center mb-2.5">
				<Controller
					name="deliveryIntent"
					control={control}
					render={({ field: { onChange, value } }) => (
						<Checkbox
							checked={value === "email"}
							id="email-invitation"
							label="Send invitation by email"
							onClick={() =>
								onChange(value === "email" ? "copy_only" : "email")
							}
						/>
					)}
				/>
				<SaveButton />
			</div>
		</form>
	);
}
