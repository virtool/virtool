import { useFetchAccount } from "@account/account";
import { useGetAdministratorRoles } from "@administration/queries";
import Button from "@base/Button";
import CopyField from "@base/CopyField";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { useListGroups } from "@groups/queries";
import { useCreateUser, useInvitationEmailAvailability } from "@users/queries";
import { INVITATION_LIFETIME_HOURS } from "@virtool/contracts";
import { useState } from "react";
import { CreateUserForm, type CreateUserFormValues } from "./CreateUserForm";

/**
 * A dialog for creating a new user
 */
export default function CreateUser() {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const [result, setResult] = useState<{
		recipient: string;
		setupUrl: string | null;
		emailQueued: boolean;
	} | null>(null);
	const mutation = useCreateUser();
	const { data: emailDeliveryAvailable } = useInvitationEmailAvailability();
	const { data: account } = useFetchAccount();
	const { data: roles = [] } = useGetAdministratorRoles();
	const { data: groups = [] } = useListGroups();

	function handleSubmit(values: CreateUserFormValues) {
		mutation.mutate(values, {
			onSuccess: (created) => {
				setResult({
					recipient: created.user.handle || created.invitation.email,
					setupUrl: created.setupToken
						? `${window.location.origin}/account-setup#token=${created.setupToken}`
						: null,
					emailQueued: created.invitation.delivery === "queued",
				});
			},
		});
	}

	function onOpenChange(open: boolean) {
		setCopied(false);
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
				<DialogTitle>{result ? "User Created" : "Create User"}</DialogTitle>
				{result ? (
					<>
						<DialogDescription>
							{result.emailQueued
								? `An invitation email to ${result.recipient} has been queued. The link in it expires after ${INVITATION_LIFETIME_HOURS} hours.`
								: `Send this link to ${result.recipient} so they can set up their account. It expires after ${INVITATION_LIFETIME_HOURS} hours and won’t be shown again.`}
						</DialogDescription>
						{result.setupUrl && !result.emailQueued && (
							<CopyField
								label="Account setup link"
								value={result.setupUrl}
								onCopy={() => setCopied(true)}
							/>
						)}
						<DialogFooter>
							<Button
								color={copied || result.emailQueued ? "blue" : "gray"}
								onClick={() => onOpenChange(false)}
							>
								Done
							</Button>
						</DialogFooter>
					</>
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
