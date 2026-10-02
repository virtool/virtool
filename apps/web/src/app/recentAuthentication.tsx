import { cn } from "@app/cn";
import { usePasskeySupport } from "@app/passkeySupport";
import type { PasskeyNotice } from "@app/passkeys";
import Button, { LinkButton } from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input, { InputPassword } from "@base/Input";
import {
	challengeRecentAuthenticationFn,
	getRecentAuthenticationMethodsFn,
} from "@server/auth/recentAuthentication";
import { useMutation } from "@tanstack/react-query";
import { SESSION_NOT_FRESH_ERROR_NAME } from "@virtool/contracts";
import { CircleAlert, Info, KeyRound } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
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

type Method = "password" | "totp";

type ChallengeValues = {
	code: string;
	password: string;
};

const RecentAuthenticationContext = createContext<(() => Promise<void>) | null>(
	null,
);

const CANCELLED_ERROR_NAME = "RecentAuthenticationCancelled";

function cancellationError(): Error {
	const error = new Error("Recent authentication was cancelled.");
	error.name = CANCELLED_ERROR_NAME;
	return error;
}

/** Whether an error is the user's cancel of a recent-authentication challenge. */
export function isRecentAuthenticationCancelled(error: unknown): boolean {
	return error instanceof Error && error.name === CANCELLED_ERROR_NAME;
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
			className="rounded text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
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
		clearErrors,
		formState: { errors, isSubmitting },
		handleSubmit,
		register,
		resetField,
		setError,
	} = useForm<ChallengeValues>({
		defaultValues: { code: "", password: "" },
		shouldUnregister: true,
	});
	const challengeMutation = useMutation({
		mutationFn: challengeRecentAuthenticationFn,
	});
	const passkeySupport = usePasskeySupport();
	const [isPasskeyPending, setPasskeyPending] = useState(false);
	const passkeyRunning = useRef(false);
	const [chosenMethod, setChosenMethod] = useState<Method | null>(null);
	const [passkeyNotice, setPasskeyNotice] = useState<PasskeyNotice | null>(
		null,
	);

	useEffect(
		() => () => {
			if (passkeyRunning.current) {
				void cancelPasskey();
			}
		},
		[],
	);

	if (methods === null) {
		return (
			<>
				<p role="status">Loading authentication methods…</p>
				<div className="mt-6 flex justify-center">{secondaryAction}</div>
			</>
		);
	}

	const hasCode = methods.password || methods.totp;
	const showPasskey = methods.passkey && passkeySupport !== "unavailable";

	if (!hasCode && !showPasskey) {
		return (
			<>
				<p role="alert">
					{methods.passkey
						? "This browser cannot use a passkey. Use a different browser, or sign out and sign in again before retrying."
						: "This session cannot complete verification. Sign out and sign in again before retrying."}
				</p>
				<div className="mt-6 flex justify-center">{secondaryAction}</div>
			</>
		);
	}

	const isBusy = isSubmitting || isPasskeyPending;
	const activeMethod: Method =
		chosenMethod && methods[chosenMethod]
			? chosenMethod
			: methods.password
				? "password"
				: "totp";
	const field = activeMethod === "password" ? "password" : "code";

	function switchMethod() {
		resetField(field);
		clearErrors(field);
		setChosenMethod(activeMethod === "password" ? "totp" : "password");
	}

	async function verifyWithPasskey() {
		if (isBusy) {
			return;
		}
		setPasskeyNotice(null);
		setPasskeyPending(true);
		passkeyRunning.current = true;
		try {
			const passkeys = await import("@app/passkeys");
			try {
				await passkeys.verifyRecentAuthenticationWithPasskey();
			} catch (error) {
				if (error instanceof passkeys.PasskeyCeremonyError) {
					setPasskeyNotice(passkeys.getPasskeyNotice(error));
					return;
				}
				if (isTerminalChallengeError(error)) {
					onFailure(normalizeError(error));
					return;
				}
				throw error;
			}
			onSuccess();
		} catch {
			setPasskeyNotice({
				message: "Your passkey could not be verified. Try again.",
				tone: "error",
			});
		} finally {
			passkeyRunning.current = false;
			setPasskeyPending(false);
		}
	}

	async function submit({ code, password }: ChallengeValues) {
		setPasskeyNotice(null);
		try {
			await challengeMutation.mutateAsync({
				data:
					activeMethod === "password"
						? { method: "password", password }
						: { method: "totp", code },
			});
			onSuccess();
		} catch (error) {
			resetField(field);
			if (isTerminalChallengeError(error)) {
				onFailure(normalizeError(error));
				return;
			}
			setError(field, {
				message:
					error instanceof Error ? error.message : "Authentication failed.",
			});
		}
	}

	const passkeySection = showPasskey ? (
		<div className="flex flex-col gap-2">
			<Button
				className="w-full justify-center"
				color="blue"
				disabled={passkeySupport !== "available" || isBusy}
				onClick={() => void verifyWithPasskey()}
			>
				<KeyRound aria-hidden size={16} />
				{isPasskeyPending
					? "Waiting for your passkey…"
					: "Continue with a passkey"}
			</Button>
			{passkeyNotice ? <PasskeyNoticeText notice={passkeyNotice} /> : null}
		</div>
	) : null;

	if (!hasCode) {
		return (
			<>
				<p className="-mt-4 mb-6 text-gray-600">
					Use your passkey to continue.
				</p>
				{passkeySection}
				<div className="mt-6 flex justify-center">{secondaryAction}</div>
			</>
		);
	}

	return (
		<form onSubmit={handleSubmit(submit)}>
			<p className="-mt-4 mb-6 text-gray-600">
				{activeMethod === "password"
					? showPasskey
						? "Use a passkey, or enter your password to continue."
						: "Enter your password to continue."
					: showPasskey
						? "Use a passkey, or enter the code from your authenticator app to continue."
						: "Enter the code from your authenticator app to continue."}
			</p>
			{passkeySection ? (
				<>
					{passkeySection}
					<div
						aria-hidden
						className="my-6 flex items-center gap-3 text-sm text-gray-500"
					>
						<span className="h-px flex-1 bg-gray-200" />
						or
						<span className="h-px flex-1 bg-gray-200" />
					</div>
				</>
			) : null}
			{activeMethod === "password" ? (
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
			) : (
				<Field>
					<FieldLabel>Authenticator code</FieldLabel>
					<Input
						autoComplete="one-time-code"
						autoFocus
						inputMode="numeric"
						maxLength={6}
						{...register("code", {
							required: "Enter your authenticator code.",
						})}
					/>
					<FieldError errors={[errors.code]} />
				</Field>
			)}
			<FormActions
				color={showPasskey ? "gray" : "blue"}
				disabled={isBusy}
				secondaryAction={secondaryAction}
				submitLabel={submitLabel}
				switchAction={
					methods.password && methods.totp ? (
						<LinkButton disabled={isBusy} onClick={switchMethod}>
							{activeMethod === "password"
								? "Use an authenticator code instead"
								: "Use your password instead"}
						</LinkButton>
					) : null
				}
			/>
		</form>
	);
}

function PasskeyNoticeText({ notice }: { notice: PasskeyNotice }) {
	const isError = notice.tone === "error";
	const Icon = isError ? CircleAlert : Info;

	return (
		<p
			role={isError ? "alert" : "status"}
			className={cn(
				"flex items-center gap-1 font-medium",
				isError ? "text-red-600" : "text-gray-600",
			)}
		>
			<Icon aria-hidden className="shrink-0" size={14} />
			{notice.message}
		</p>
	);
}

async function cancelPasskey() {
	const { cancelPasskeyCeremony } = await import("@app/passkeys");
	cancelPasskeyCeremony();
}

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error("Authentication failed.");
}

function isTerminalChallengeError(error: unknown): boolean {
	const normalized = normalizeError(error);
	return (normalized as Error & { status?: number }).status !== 400;
}

function FormActions({
	color,
	disabled,
	secondaryAction,
	submitLabel,
	switchAction,
}: {
	color: "blue" | "gray";
	disabled: boolean;
	secondaryAction: ReactNode;
	submitLabel: string;
	switchAction: ReactNode;
}) {
	return (
		<div className="mt-6 flex flex-col items-center gap-4">
			<Button
				className="w-full justify-center"
				color={color}
				disabled={disabled}
				type="submit"
			>
				{submitLabel}
			</Button>
			<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
				{switchAction}
				{secondaryAction}
			</div>
		</div>
	);
}
