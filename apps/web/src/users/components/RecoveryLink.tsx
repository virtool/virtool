import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import CopyField from "@base/CopyField";
import SectionHeader from "@base/SectionHeader";
import {
	issueAdministratorRecoveryFn,
	revokeAdministratorRecoveryFn,
} from "@server/auth/recoveryFunctions";
import { useRef, useState } from "react";

type RecoveryLinkProps = { userId: number };

/** Issue or revoke an administrator recovery link for a user. */
export default function RecoveryLink({ userId }: RecoveryLinkProps) {
	const [url, setUrl] = useState("");
	const [message, setMessage] = useState("");
	const [pending, setPending] = useState(false);
	const submitting = useRef(false);

	async function issue() {
		if (submitting.current) {
			return;
		}
		submitting.current = true;
		setPending(true);
		setUrl("");
		setMessage("");
		try {
			const result = await issueAdministratorRecoveryFn({ data: { userId } });
			setUrl(result.url);
			setMessage(
				result.delivery === "queued"
					? "Password reset email queued. You can also copy the link below. It won’t be shown again."
					: "Email is unavailable. Copy the link below and send it to the user. It won’t be shown again.",
			);
		} catch {
			setMessage("Could not create a password reset link. Try again.");
		} finally {
			submitting.current = false;
			setPending(false);
		}
	}

	async function revoke() {
		if (submitting.current) {
			return;
		}
		submitting.current = true;
		setPending(true);
		setMessage("");
		try {
			await revokeAdministratorRecoveryFn({ data: { userId } });
			setUrl("");
			setMessage("Password reset links revoked.");
		} catch {
			setMessage("Could not revoke password reset links. Try again.");
		} finally {
			submitting.current = false;
			setPending(false);
		}
	}

	return (
		<section className="mt-6">
			<SectionHeader level={3}>
				<h3>Password reset link</h3>
				<p>
					Create a one-time link that lets this user reset their password. It
					expires after one hour. Creating another link disables the previous
					one.
				</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<div className="flex flex-wrap gap-2">
						<Button
							color="blue"
							disabled={pending}
							onClick={() => void issue()}
						>
							Create reset link
						</Button>
						<Button disabled={pending} onClick={() => void revoke()}>
							Revoke links
						</Button>
					</div>
					{message && (
						<p className="mt-3" role="status">
							{message}
						</p>
					)}
					{url && (
						<div className="mt-3">
							<CopyField label="Password reset link" value={url} />
						</div>
					)}
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
