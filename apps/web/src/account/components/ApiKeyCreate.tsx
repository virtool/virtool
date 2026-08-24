import { writeToClipboard } from "@app/clipboard";
import { cn } from "@app/cn";
import { useIsSecureContext } from "@app/hooks";
import Button, { buttonVariants } from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import type { Permissions } from "@virtool/contracts";
import { emptyPermissions } from "@virtool/contracts";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCreateApiKey } from "../queries";
import ApiKeyAdministratorInfo from "./ApiKeyAdministratorInfo";
import ApiKeyPermissions from "./ApiKeyPermissions";

type FormValues = {
	name: string;
	permissions: Permissions;
};

/**
 * Displays a dialog to create an API key
 */
export default function ApiKeyCreate() {
	const [copied, setCopied] = useState(false);
	const [newKey, setNewKey] = useState("");
	const mutation = useCreateApiKey();
	const permissionsLabelId = useId();
	const isSecureContext = useIsSecureContext();

	const {
		formState: { errors },
		handleSubmit,
		control,
		register,
		reset,
	} = useForm<FormValues>({
		defaultValues: {
			name: "",
			permissions: emptyPermissions(),
		},
	});

	const showCreated = Boolean(newKey);

	function handleOpenChange(open: boolean) {
		if (!open) {
			setCopied(false);
			setNewKey("");
			reset();
		}
	}

	function onSubmit({ name, permissions }: FormValues) {
		mutation.mutate(
			{ name, permissions },
			{
				onSuccess: (data) => {
					setNewKey(data.key ?? "");
				},
			},
		);
	}

	function copyToClipboard() {
		writeToClipboard(newKey).then(() => setCopied(true));
	}

	return (
		<Dialog onOpenChange={handleOpenChange}>
			<DialogTrigger className={buttonVariants({ color: "blue" })}>
				Create
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Create API Key</DialogTitle>
				<DialogDescription>
					Create a new key for accessing the Virtool API.
				</DialogDescription>
				{showCreated ? (
					<div className="flex flex-col items-center mt-10 mb-4">
						<p className="font-medium text-lg">Here is your key.</p>
						<p className="font-medium mb-4 text-slate-600">
							Make note of it now. For security purposes, it will not be shown
							again.
						</p>

						<div className="flex items-stretch mb-2 w-full">
							<InputSimple className="w-full" value={newKey} readOnly />
							{isSecureContext && (
								<Button className="ml-2" color="blue" onClick={copyToClipboard}>
									Copy
								</Button>
							)}
						</div>
						<p
							className={cn("font-medium text-sm text-cyan-700", {
								invisible: !copied,
							})}
						>
							Copied
						</p>
					</div>
				) : (
					<form onSubmit={handleSubmit(onSubmit)}>
						<ApiKeyAdministratorInfo />
						<InputGroup>
							<InputLabel htmlFor="name">Name</InputLabel>
							<InputSimple
								id="name"
								aria-required
								aria-invalid={Boolean(errors.name) || undefined}
								aria-describedby={errors.name ? "name-error" : undefined}
								{...register("name", {
									required: "Provide a name for the key",
								})}
							/>
							<InputError id="name-error">{errors.name?.message}</InputError>
						</InputGroup>

						<InputLabel id={permissionsLabelId}>Permissions</InputLabel>
						<Controller
							control={control}
							render={({ field: { onChange, value } }) => (
								<ApiKeyPermissions
									aria-labelledby={permissionsLabelId}
									keyPermissions={value}
									onChange={onChange}
								/>
							)}
							name="permissions"
						/>

						<DialogFooter>
							<SaveButton />
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
