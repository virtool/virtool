import Button from "@base/Button";
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
					? "Recovery email queued. This link can also be copied now."
					: "Email is unavailable. Copy this link and give it to the user through a trusted channel.",
			);
		} catch {
			setMessage("Could not issue a recovery link. Try again.");
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
			setMessage("Outstanding administrator recovery links revoked.");
		} catch {
			setMessage("Could not revoke recovery links. Try again.");
		} finally {
			submitting.current = false;
			setPending(false);
		}
	}

	return (
		<section className="mt-6" aria-labelledby="recovery-link-title">
			<h3 id="recovery-link-title">Administrator recovery link</h3>
			<p>
				Links work once and expire after one hour. Issuing a new link replaces
				the previous one.
			</p>
			<div className="flex gap-2">
				<Button color="blue" disabled={pending} onClick={() => void issue()}>
					Issue link
				</Button>
				<Button disabled={pending} onClick={() => void revoke()}>
					Revoke links
				</Button>
			</div>
			{url && (
				<div>
					<label htmlFor="administrator-recovery-url">Recovery URL</label>
					<input
						id="administrator-recovery-url"
						readOnly
						value={url}
						onFocus={(event) => event.target.select()}
					/>
				</div>
			)}
			{message && <p role="status">{message}</p>}
		</section>
	);
}
