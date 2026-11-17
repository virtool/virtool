import { isRecentAuthenticationCancelled } from "@app/recentAuthentication";
import { registerUsernameInput } from "@app/usernameInput";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldError } from "@base/Field";
import { UserAvatar } from "@base/Icon";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import type { AvatarSource } from "@virtool/contracts";
import { useForm } from "react-hook-form";
import { useUpdateUsername } from "../queries";
import AccountAvatar from "./AccountAvatar";

type FormValues = {
	username: string;
};

type UsernameProps = {
	/** Where the account's avatar image comes from */
	avatarSource: AvatarSource;

	/** The user's current username */
	username: string;
};

/**
 * A component to update the account's username and avatar
 */
export default function AccountUsername({
	avatarSource,
	username,
}: UsernameProps) {
	// `values` re-syncs the input when the username prop changes after a successful
	// update and refetch. Unlike a `reset()` effect, it deep-compares, so a
	// re-render that leaves the username untouched cannot wipe a validation error.
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ values: { username } });
	const mutation = useUpdateUsername();

	function onSubmit(values: FormValues) {
		mutation.mutate({ username: values.username });
	}

	return (
		<section>
			<SectionHeader level={3}>
				<h3>Username and avatar</h3>
				<p>How other users see you in Virtool.</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<form
						className="flex items-start justify-between gap-3"
						onSubmit={handleSubmit(onSubmit)}
					>
						<div className="flex h-9 min-w-0 items-center gap-2 font-medium">
							<UserAvatar username={username} size="lg" />
							<span className="truncate">{username}</span>
						</div>
						<div className="flex w-full min-w-0 max-w-sm items-start gap-3">
							<Field className="mb-0 min-w-0 flex-1 pb-0">
								<Input
									aria-label="Username"
									autoComplete="off"
									aria-required
									{...registerUsernameInput(
										register("username", {
											required: "Please specify a username",
										}),
									)}
								/>
								<FieldError
									className="empty:my-0 empty:min-h-0"
									errors={[
										errors.username,
										mutation.isError &&
										!isRecentAuthenticationCancelled(mutation.error)
											? { message: mutation.error.message }
											: undefined,
									]}
								/>
							</Field>
							<SaveButton altText="Change" />
						</div>
					</form>
				</BoxGroupSection>
				<AccountAvatar avatarSource={avatarSource} />
			</BoxGroup>
		</section>
	);
}
