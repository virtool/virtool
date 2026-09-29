import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input, { InputPassword } from "@base/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base/Tabs";
import {
	challengeRecentAuthenticationFn,
	getRecentAuthenticationMethodsFn,
} from "@server/auth/recentAuthentication";
import { useMutation } from "@tanstack/react-query";
import { SESSION_NOT_FRESH_ERROR_NAME } from "@virtool/contracts";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import { useForm } from "react-hook-form";

type Methods = Awaited<ReturnType<typeof getRecentAuthenticationMethodsFn>>;

type PendingChallenge = {
	id: number;
	methods: Methods | null;
	promise: Promise<void>;
	reject: (reason: Error) => void;
	resolve: () => void;
};

type ChallengeValues = {
	code: string;
	password: string;
};

const RecentAuthenticationContext = createContext<(() => Promise<void>) | null>(
	null,
);

function cancellationError(): Error {
	const error = new Error("Recent authentication was cancelled.");
	error.name = "RecentAuthenticationCancelled";
	return error;
}

/** Coordinate one shared recent-authentication challenge for the application. */
export function RecentAuthenticationProvider({
	children,
}: {
	children: ReactNode;
}) {
	const pendingRef = useRef<PendingChallenge | null>(null);
	const nextChallengeId = useRef(0);
	const [pending, setPending] = useState<PendingChallenge | null>(null);

	const requestChallenge = useCallback(async () => {
		if (pendingRef.current) {
			return pendingRef.current.promise;
		}

		const deferred = Promise.withResolvers<void>();
		const challenge: PendingChallenge = {
			id: nextChallengeId.current++,
			methods: null,
			promise: deferred.promise,
			reject: deferred.reject,
			resolve: deferred.resolve,
		};
		pendingRef.current = challenge;
		setPending(challenge);

		try {
			const methods = await getRecentAuthenticationMethodsFn();
			if (pendingRef.current === challenge) {
				const ready = { ...challenge, methods };
				pendingRef.current = ready;
				setPending(ready);
			}
		} catch (error) {
			if (pendingRef.current === challenge) {
				pendingRef.current = null;
				setPending(null);
				challenge.reject(
					error instanceof Error ? error : new Error("Authentication failed."),
				);
			}
		}

		return challenge.promise;
	}, []);

	function settleChallenge(error?: Error) {
		const challenge = pendingRef.current;
		if (!challenge) {
			return;
		}
		pendingRef.current = null;
		setPending(null);
		if (error) {
			challenge.reject(error);
		} else {
			challenge.resolve();
		}
	}

	return (
		<RecentAuthenticationContext.Provider value={requestChallenge}>
			{children}
			{pending ? (
				<RecentAuthenticationDialog
					key={pending.id}
					methods={pending.methods}
					onCancel={() => settleChallenge(cancellationError())}
					onFailure={(error) => settleChallenge(error)}
					onSuccess={() => settleChallenge()}
					open
				/>
			) : null}
		</RecentAuthenticationContext.Provider>
	);
}

/** Add one shared challenge and one automatic retry to a sensitive mutation. */
export function useRecentlyAuthenticatedMutation<TResult, TVariables>(
	mutation: (variables: TVariables) => Promise<TResult>,
) {
	const requestChallenge = useContext(RecentAuthenticationContext);
	if (!requestChallenge) {
		throw new Error(
			"useRecentlyAuthenticatedMutation requires RecentAuthenticationProvider",
		);
	}

	return useCallback(
		async (variables: TVariables): Promise<TResult> => {
			try {
				return await mutation(variables);
			} catch (error) {
				if (
					!(error instanceof Error) ||
					error.name !== SESSION_NOT_FRESH_ERROR_NAME
				) {
					throw error;
				}
			}

			await requestChallenge();
			return mutation(variables);
		},
		[mutation, requestChallenge],
	);
}

function RecentAuthenticationDialog({
	methods,
	onCancel,
	onFailure,
	onSuccess,
	open,
}: {
	methods: Methods | null;
	onCancel: () => void;
	onFailure: (error: Error) => void;
	onSuccess: () => void;
	open: boolean;
}) {
	return (
		<DialogPrimitive.Root
			open={open}
			onOpenChange={(nextOpen) => !nextOpen && onCancel()}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Content
					aria-describedby={undefined}
					className="fixed inset-0 z-dialog overflow-y-auto bg-gray-50 focus:outline-none"
				>
					<AuthenticationPage
						title={
							<DialogPrimitive.Title className="text-xl font-medium">
								Confirm your identity
							</DialogPrimitive.Title>
						}
					>
						<RecentAuthenticationForm
							methods={methods}
							onFailure={onFailure}
							onSuccess={onSuccess}
							secondaryAction={<AuthenticationCancel onClick={onCancel} />}
							submitLabel="Continue"
						/>
					</AuthenticationPage>
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

/** A standalone surface for identity challenges. */
export function AuthenticationPage({
	children,
	title,
}: {
	children: ReactNode;
	title?: ReactNode;
}) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-gray-50 px-6 py-12 sm:pb-32">
			<section
				aria-label="Confirm your identity"
				className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm"
			>
				<div className="mb-7">
					{title ?? (
						<h1 className="text-xl font-medium">Confirm your identity</h1>
					)}
				</div>
				{children}
			</section>
		</main>
	);
}

/** A subdued escape action for an identity challenge. */
export function AuthenticationCancel({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded text-gray-600 hover:text-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
		>
			Cancel
		</button>
	);
}

/** Verify a fresh session with an available account method. */
export function RecentAuthenticationForm({
	methods,
	onFailure,
	onSuccess,
	secondaryAction,
	submitLabel,
}: {
	methods: Methods | null;
	onFailure: (error: Error) => void;
	onSuccess: () => void;
	secondaryAction: ReactNode;
	submitLabel: string;
}) {
	const {
		formState: { errors, isSubmitting },
		handleSubmit,
		register,
		resetField,
		setError,
	} = useForm<ChallengeValues>({
		defaultValues: { code: "", password: "" },
	});
	const challengeMutation = useMutation({
		mutationFn: challengeRecentAuthenticationFn,
	});
	const defaultMethod = methods?.password ? "password" : "totp";

	async function submitPassword({ password }: ChallengeValues) {
		try {
			await challengeMutation.mutateAsync({
				data: { method: "password", password },
			});
			onSuccess();
		} catch (error) {
			resetField("password");
			if (isTerminalChallengeError(error)) {
				onFailure(normalizeError(error));
				return;
			}
			setError("password", {
				message:
					error instanceof Error ? error.message : "Authentication failed.",
			});
		}
	}

	async function submitTotp({ code }: ChallengeValues) {
		try {
			await challengeMutation.mutateAsync({
				data: { method: "totp", code },
			});
			onSuccess();
		} catch (error) {
			resetField("code");
			if (isTerminalChallengeError(error)) {
				onFailure(normalizeError(error));
				return;
			}
			setError("code", {
				message:
					error instanceof Error ? error.message : "Authentication failed.",
			});
		}
	}

	return (
		<>
			{methods === null ? (
				<p role="status">Loading authentication methods…</p>
			) : !methods.password && !methods.totp ? (
				<p role="alert">
					This session cannot complete verification. Sign out and sign in again
					before retrying.
				</p>
			) : (
				<Tabs defaultValue={defaultMethod}>
					{methods.password && methods.totp ? (
						<TabsList>
							<TabsTrigger value="password">Password</TabsTrigger>
							<TabsTrigger value="totp">Authenticator code</TabsTrigger>
						</TabsList>
					) : null}
					{methods.password ? (
						<TabsContent value="password">
							<form onSubmit={handleSubmit(submitPassword)}>
								<Field>
									<FieldLabel>Password</FieldLabel>
									<InputPassword
										showVisibilityToggle={false}
										autoComplete="current-password"
										autoFocus
										{...register("password", {
											required: "Enter your password.",
										})}
									/>
									<FieldError errors={[errors.password]} />
								</Field>
								<FormActions
									disabled={isSubmitting}
									secondaryAction={secondaryAction}
									submitLabel={submitLabel}
								/>
							</form>
						</TabsContent>
					) : null}
					{methods.totp ? (
						<TabsContent value="totp">
							<form onSubmit={handleSubmit(submitTotp)}>
								<Field>
									<FieldLabel>Authenticator code</FieldLabel>
									<Input
										autoComplete="one-time-code"
										inputMode="numeric"
										autoFocus={!methods.password}
										{...register("code", {
											required: "Enter your authenticator code.",
										})}
									/>
									<FieldError errors={[errors.code]} />
								</Field>
								<FormActions
									disabled={isSubmitting}
									secondaryAction={secondaryAction}
									submitLabel={submitLabel}
								/>
							</form>
						</TabsContent>
					) : null}
				</Tabs>
			)}
			{methods === null || (!methods.password && !methods.totp) ? (
				<div className="mt-6 flex justify-center">{secondaryAction}</div>
			) : null}
		</>
	);
}

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error("Authentication failed.");
}

function isTerminalChallengeError(error: unknown): boolean {
	const normalized = normalizeError(error);
	return (normalized as Error & { status?: number }).status !== 400;
}

function FormActions({
	disabled,
	secondaryAction,
	submitLabel,
}: {
	disabled: boolean;
	secondaryAction: ReactNode;
	submitLabel: string;
}) {
	return (
		<div className="mt-6 flex flex-col items-center gap-4">
			<Button
				className="w-full justify-center"
				color="blue"
				disabled={disabled}
				type="submit"
			>
				{submitLabel}
			</Button>
			{secondaryAction}
		</div>
	);
}
