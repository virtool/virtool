import { passwordPolicyQueryOptions } from "@administration/passwordPolicy";
import { useQuery } from "@tanstack/react-query";
import { formatMinimumPasswordLengthMessage } from "@virtool/contracts";

/** react-hook-form rules for a field that sets a new password. */
export type PasswordRules = {
	required: string;
	minLength?: { value: number; message: string };
};

/**
 * Rules for a field that sets a new password, enforcing the instance's
 * configured minimum length.
 *
 * While the policy is in flight, or if its request failed, no length rule is
 * applied at all. The configured minimum can be *lower* than the default, so
 * guessing one here would reject passwords the server accepts and leave the
 * user unable to proceed. Omitting the rule instead defers to the server, which
 * is the only authority on the setting and rejects a short password with a
 * message quoting it.
 */
export function usePasswordRules(): PasswordRules {
	const { data } = useQuery(passwordPolicyQueryOptions());

	if (!data) {
		return { required: "Please provide a password" };
	}

	const message = formatMinimumPasswordLengthMessage(
		data.minimumPasswordLength,
	);

	return {
		required: message,
		minLength: { value: data.minimumPasswordLength, message },
	};
}
