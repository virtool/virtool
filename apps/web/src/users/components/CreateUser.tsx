import { useFetchAccount } from "@account/account";
import { useGetAdministratorRoles } from "@administration/queries";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { InputSimple } from "@base/Input";
import { useListGroups } from "@groups/queries";
import { useCreateUser } from "@users/queries";
import { useState } from "react";
import { CreateUserForm, type CreateUserFormValues } from "./CreateUserForm";

/**
 * A dialog for creating a new user
 */
export default function CreateUser() {
	const [open, setOpen] = useState(false);
	const [result, setResult] = useState<{
		setupUrl: string | null;
		emailQueued: boolean;
	} | null>(null);
	const mutation = useCreateUser();
	const { data: account } = useFetchAccount();
	const { data: roles = [] } = useGetAdministratorRoles();
	const { data: groups = [] } = useListGroups();

	function handleSubmit(values: CreateUserFormValues) {
		mutation.mutate(values, {
			onSuccess: (created) => {
				setResult({
					setupUrl: created.setupToken
						? `${window.location.origin}/account-setup#token=${created.setupToken}`
						: null,
					emailQueued: created.invitation.delivery === "queued",
				});
			},
		});
	}

	function onOpenChange(open: boolean) {
		mutation.reset();
		setResult(null);
		setOpen(open);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Button as={DialogTrigger} color="blue">
				Create
			</Button>
			<DialogContent>
				<DialogTitle>Create User</DialogTitle>
				{result ? (
					<div>
						{result.emailQueued ? (
							<p>The invitation email has been queued.</p>
						) : (
							<>
								<p>Share this setup link once. It will not be shown again.</p>
								<InputSimple
									readOnly
									value={result.setupUrl ?? ""}
									aria-label="Account setup link"
								/>
								<Button
									type="button"
									onClick={() =>
										navigator.clipboard.writeText(result.setupUrl ?? "")
									}
								>
									Copy link
								</Button>
							</>
						)}
					</div>
				) : (
					<CreateUserForm
						onSubmit={handleSubmit}
						error={mutation.isError ? mutation.error.message : ""}
						groups={groups}
						roles={roles}
						canAssignAdministratorRole={account?.administratorRole === "full"}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
