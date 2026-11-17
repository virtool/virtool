/** The distinct, non-empty messages in a list of errors, in order. */
export function getErrorMessages(
	errors: Array<{ message?: string } | undefined> | undefined,
): string[] {
	return [
		...new Set(
			(errors ?? [])
				.map((error) => error?.message)
				.filter((message): message is string => Boolean(message)),
		),
	];
}
