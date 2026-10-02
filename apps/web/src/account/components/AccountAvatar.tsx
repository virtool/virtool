import { BoxGroupSection } from "@base/Box";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle,
} from "@base/Field";
import Switch from "@base/Switch";
import type { AvatarSource } from "@virtool/contracts";
import { useUpdateAccountSettings } from "../queries";

type AccountAvatarProps = {
	/** Where the account's avatar image comes from */
	avatarSource: AvatarSource;
};

/** A switch that chooses where the account's avatar image comes from. */
export default function AccountAvatar({ avatarSource }: AccountAvatarProps) {
	const mutation = useUpdateAccountSettings();

	return (
		<BoxGroupSection>
			<FieldLabel variant="row">
				<Field className="flex-1 gap-5" orientation="horizontal">
					<FieldContent>
						<FieldTitle className="font-semibold">Use Gravatar</FieldTitle>
						<FieldDescription>
							Show the Gravatar for your email address. If you do not have one,
							Gravatar makes a pattern for you.
						</FieldDescription>
					</FieldContent>
					<Switch
						checked={avatarSource === "gravatar"}
						onCheckedChange={(checked) =>
							mutation.mutate({
								avatarSource: checked ? "gravatar" : "initials",
							})
						}
					/>
				</Field>
			</FieldLabel>
			{mutation.isError ? (
				<p className="text-red-600 text-sm" role="alert">
					Could not save the setting. Try again.
				</p>
			) : null}
		</BoxGroupSection>
	);
}
