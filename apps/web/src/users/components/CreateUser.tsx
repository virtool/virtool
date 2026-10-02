import { useFetchAccount } from "@account/account";
import { useGetAdministratorRoles } from "@administration/queries";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { useListGroups } from "@groups/queries";
import { useCreateUser, useInvitationEmailAvailability } from "@users/queries";
import { getAccountSetupUrl } from "@users/utils";
import { useState } from "react";
import { CreateUserForm, type CreateUserFormValues } from "./CreateUserForm";
import { InvitationIssued, type IssuedInvitation } from "./InvitationIssued";

/**
 * A dialog for creating a new user
 */
export default function CreateUser() {
	const [open, setOpen] = useState(false);
	const [issued, setIssued] = useState<IssuedInvitation | null>(null);
	const mutation = useCreateUser();
	const { data: emailDeliveryAvailable } = useInvitationEmailAvailability();
	const { data: account } = useFetchAccount();
	const { data: roles = [] } = useGetAdministratorRoles();
	const { data: groups = [] } = useListGroups();

	function handleSubmit(values: CreateUserFormValues) {
		mutation.mutate(values, {
			onSuccess: (created) => {
				setIssued({
					recipient: created.user.handle || created.invitation.email,
					setupUrl: created.setupToken
						? getAccountSetupUrl(created.setupToken)
						: null,
					emailQueued: created.invitation.delivery === "queued",
				});
			},
		});
	}

	function onOpenChange(open: boolean) {
		mutation.reset();
		setIssued(null);
		setOpen(open);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Button as={DialogTrigger} color="blue">
				Create
			</Button>
			<DialogContent>
				<DialogTitle>{issued ? "User Created" : "Create User"}</DialogTitle>
				{issued ? (
					<InvitationIssued
						issued={issued}
						onDone={() => onOpenChange(false)}
					/>
				) : (
					<CreateUserForm
						onSubmit={handleSubmit}
						error={mutation.isError ? mutation.error.message : ""}
						groups={groups}
						roles={roles}
						canAssignAdministratorRole={account?.administratorRole === "full"}
						canConfigureEmailDelivery={account?.administratorRole === "full"}
						emailDeliveryAvailable={emailDeliveryAvailable === true}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
