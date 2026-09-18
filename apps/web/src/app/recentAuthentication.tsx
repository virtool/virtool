import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@base/Dialog";
import {
	InputError,
	InputGroup,
	InputLabel,
	InputPassword,
	InputSimple,
} from "@base/Input";
import SaveButton from "@base/SaveButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base/Tabs";
import {
	challengeRecentAuthenticationFn,
	getRecentAuthenticationMethodsFn,
} from "@server/auth/recentAuthentication";
import { useMutation } from "@tanstack/react-query";
import { SESSION_NOT_FRESH_ERROR_NAME } from "@virtool/contracts";
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
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
			<DialogContent>
				<DialogTitle>Confirm it’s you</DialogTitle>
				<DialogDescription>
					Authenticate again to continue this security-sensitive action.
				</DialogDescription>
				{methods === null ? (
					<p role="status">Loading authentication methods…</p>
				) : !methods.password && !methods.totp ? (
					<p role="alert">
						This session cannot complete recent authentication. Sign out and
						sign in again before retrying.
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
									<InputGroup>
										<InputLabel htmlFor="recent-auth-password">
											Password
										</InputLabel>
										<InputPassword
											id="recent-auth-password"
											autoComplete="current-password"
											aria-invalid={Boolean(errors.password) || undefined}
											{...register("password", {
												required: "Enter your password.",
											})}
										/>
										<InputError>{errors.password?.message}</InputError>
									</InputGroup>
									<DialogActions disabled={isSubmitting} onCancel={onCancel} />
								</form>
							</TabsContent>
						) : null}
						{methods.totp ? (
							<TabsContent value="totp">
								<form onSubmit={handleSubmit(submitTotp)}>
									<InputGroup>
										<InputLabel htmlFor="recent-auth-code">
											Authenticator code
										</InputLabel>
										<InputSimple
											id="recent-auth-code"
											autoComplete="one-time-code"
											inputMode="numeric"
											aria-invalid={Boolean(errors.code) || undefined}
											{...register("code", {
												required: "Enter your authenticator code.",
											})}
										/>
										<InputError>{errors.code?.message}</InputError>
									</InputGroup>
									<DialogActions disabled={isSubmitting} onCancel={onCancel} />
								</form>
							</TabsContent>
						) : null}
					</Tabs>
				)}
				{methods && !methods.password && !methods.totp ? (
					<DialogFooter>
						<Button onClick={onCancel}>Close</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error("Authentication failed.");
}

function isTerminalChallengeError(error: unknown): boolean {
	const normalized = normalizeError(error);
	return (normalized as Error & { status?: number }).status !== 400;
}

function DialogActions({
	disabled,
	onCancel,
}: {
	disabled: boolean;
	onCancel: () => void;
}) {
	return (
		<DialogFooter className="gap-2">
			<Button disabled={disabled} onClick={onCancel}>
				Cancel
			</Button>
			<SaveButton altText="Continue" disabled={disabled} />
		</DialogFooter>
	);
}
