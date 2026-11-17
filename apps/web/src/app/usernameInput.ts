import type { UseFormRegisterReturn } from "react-hook-form";

/**
 * Lowercase an input's value in place, so a user who types "Ada" sees `ada`.
 *
 * The server folds usernames to lowercase. Showing that while the user types
 * means the value they see is the value they submit. The caret stays where the
 * user left it, because writing `value` moves it to the end.
 */
export function lowercaseInputValue(input: HTMLInputElement): void {
	const lowered = input.value.toLowerCase();

	if (lowered === input.value) {
		return;
	}

	const { selectionStart, selectionEnd } = input;
	input.value = lowered;
	input.setSelectionRange(selectionStart, selectionEnd);
}

/**
 * Wrap a react-hook-form registration for a username input so its value is
 * lowercased as the user types.
 */
export function registerUsernameInput<Name extends string>(
	registration: UseFormRegisterReturn<Name>,
): UseFormRegisterReturn<Name> {
	return {
		...registration,
		onChange(event) {
			lowercaseInputValue(event.target);
			return registration.onChange(event);
		},
	};
}
