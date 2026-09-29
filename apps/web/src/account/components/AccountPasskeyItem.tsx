import { getPasskeyNotice } from "@app/passkeys";
import { BoxGroupSection } from "@base/Box";
import DeleteDialog from "@base/DeleteDialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { IconButton } from "@base/Icon";
import {
	InputContainer,
	InputError,
	InputGroup,
	InputLabel,
	InputSimple,
} from "@base/Input";
import Label from "@base/Label";
import RelativeTime from "@base/RelativeTime";
import SaveButton from "@base/SaveButton";
import {
	PASSKEY_NAME_MAX_LENGTH,
	type PasskeySummary,
	passkeyNameSchema,
} from "@virtool/contracts";
import { Pencil, Trash } from "lucide-react";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useRemovePasskey, useRenamePasskey } from "../queries";

type AccountPasskeyItemProps = {
	passkey: PasskeySummary;
};

type FormValues = {
	name: string;
};

function PasskeyRename({ passkey }: AccountPasskeyItemProps) {
	const [open, setOpen] = useState(false);
	const inputId = useId();
	const mutation = useRenamePasskey();
	const {
		formState: { errors },
		handleSubmit,
		register,
		reset,
	} = useForm<FormValues>({ defaultValues: { name: passkey.name } });

	function handleOpenChange(next: boolean) {
		setOpen(next);
		if (next) {
			reset({ name: passkey.name });
			mutation.reset();
		}
	}

	function onSubmit({ name }: FormValues) {
		mutation.mutate(
			{ managementId: passkey.managementId, name },
			{ onSuccess: () => setOpen(false) },
		);
	}

	const error =
		errors.name?.message ||
		(mutation.isError ? getPasskeyNotice(mutation.error)?.message : null);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<IconButton IconComponent={Pencil} tip={`Rename ${passkey.name}`} />
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Rename passkey</DialogTitle>
				<DialogDescription>
					Choose a name that helps you recognize this passkey.
				</DialogDescription>
				<form className="mt-4" onSubmit={handleSubmit(onSubmit)}>
					<InputGroup>
						<InputLabel htmlFor={inputId}>Name</InputLabel>
						<InputContainer>
							<InputSimple
								id={inputId}
								aria-invalid={Boolean(error) || undefined}
								aria-describedby={error ? `${inputId}-error` : undefined}
								maxLength={PASSKEY_NAME_MAX_LENGTH}
								{...register("name", {
									validate: (value) => {
										const result = passkeyNameSchema.safeParse(value);
										return (
											result.success || result.error.issues[0]?.message || false
										);
									},
								})}
							/>
							<InputError id={`${inputId}-error`}>{error}</InputError>
						</InputContainer>
					</InputGroup>
					<div className="flex justify-end">
						<SaveButton disabled={mutation.isPending} />
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** One of the account's passkeys, with controls to rename or remove it. */
export default function AccountPasskeyItem({
	passkey,
}: AccountPasskeyItemProps) {
	const removeMutation = useRemovePasskey();

	return (
		<BoxGroupSection className="flex items-center justify-between gap-4">
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="font-medium text-lg">{passkey.name}</span>
					{passkey.multiDevice && <Label>Synced</Label>}
				</div>
				<span className="text-gray-600 text-sm">
					{passkey.createdAt ? (
						<>
							Added <RelativeTime time={passkey.createdAt} />
						</>
					) : (
						"Date added unknown"
					)}
				</span>
			</div>
			<div className="flex items-center">
				<PasskeyRename passkey={passkey} />
				<DeleteDialog
					name={passkey.name}
					noun="passkey"
					message={
						<>
							Remove <strong>{passkey.name}</strong>? You will no longer be able
							to sign in with it. Your password, two-factor authentication, and
							current session are not affected. Also remove the passkey from
							your device or password manager.
						</>
					}
					onConfirm={() =>
						removeMutation.mutateAsync({ managementId: passkey.managementId })
					}
					trigger={
						<IconButton
							color="red"
							IconComponent={Trash}
							tip={`Remove ${passkey.name}`}
						/>
					}
				/>
			</div>
		</BoxGroupSection>
	);
}
