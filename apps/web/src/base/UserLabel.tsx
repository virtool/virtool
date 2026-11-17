import { cn } from "@app/cn";
import { UserAvatar } from "@base/Icon";

type UserLabelProps = {
	className?: string;

	/** The account's username, which the label both draws and reads out */
	username: string;
};

/**
 * A user's username beside their initial icon, for a list or table cell that
 * names an account rather than attributing an action to one.
 *
 * The icon is decorative: the username it draws is already the text beside it,
 * and `UserAvatar` labels itself with it.
 */
export default function UserLabel({ className, username }: UserLabelProps) {
	return (
		<span className={cn("inline-flex items-center gap-2", className)}>
			<span aria-hidden>
				<UserAvatar size="md" username={username} />
			</span>
			{username}
		</span>
	);
}
