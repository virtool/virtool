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
