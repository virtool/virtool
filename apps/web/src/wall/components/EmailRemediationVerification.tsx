import { accountQueryKeys } from "@account/keys";
import { safeRedirect } from "@app/searchParams";
import Alert from "@base/Alert";
import Button from "@base/Button";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { EmailRemediationVerificationResult } from "@virtool/contracts";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { rootQueryKeys } from "../keys";
import { completeEmailRemediation } from "../queries";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type VerificationState =
	| { status: "loading" }
	| (EmailRemediationVerificationResult & {
			canRetry: boolean;
			redirect?: string;
	  });

/** Token-safe result screen for an emailed remediation challenge. */
export default function EmailRemediationVerification() {
	const [state, setState] = useState<VerificationState>({ status: "loading" });
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	useLayoutEffect(() => {
		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const token = fragment.get("token");
		const redirect = safeRedirect(fragment.get("redirect"));
		window.history.replaceState(
			window.history.state,
			"",
			window.location.pathname,
		);

		if (!token || !/^[0-9a-f]{64}$/.test(token)) {
			setState({
				status: "unusable",
				authenticated: false,
				canRetry: false,
				redirect,
			});
			return;
		}

		void completeEmailRemediation(token)
			.then((result) => setState({ ...result, redirect }))
			.catch(() =>
				setState({
					status: "unusable",
					authenticated: false,
					canRetry: false,
					redirect,
				}),
			);
	}, []);

	function continueJourney() {
		if (state.status === "loading") {
			return;
		}
		queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
		queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
		if (state.authenticated) {
			navigate({ to: state.redirect ?? "/" });
			return;
		}
		navigate({
			to: "/login",
			search: { redirect: state.redirect },
		});
	}

	function retry() {
		if (state.status === "loading") {
			return;
		}
		navigate({
			to: "/email-remediation",
			search: { redirect: state.redirect },
		});
	}

	if (state.status === "loading") {
		return (
			<WallContainer>
				<WallTitle
					title="Verifying email"
					subtitle="Checking your verification link…"
				/>
			</WallContainer>
		);
	}

	if (state.status === "verified" || state.status === "already_verified") {
		return (
			<WallContainer>
				<WallTitle
					title="Email verified"
					subtitle={
						state.authenticated
							? "Your account is ready."
							: "Your email is verified. Log in to continue."
					}
				/>
				<Alert color="green" icon={CircleCheck}>
					{state.status === "already_verified"
						? "This email was already verified."
						: "Your email address has been verified."}
				</Alert>
				<div className="flex justify-end">
					<Button color="blue" onClick={continueJourney}>
						{state.authenticated ? "Continue" : "Log in"}
					</Button>
				</div>
			</WallContainer>
		);
	}

	const message = {
		expired: "This verification link has expired.",
		superseded: "A newer verification link has replaced this one.",
		unusable: "This verification link cannot be used.",
	}[state.status];

	return (
		<WallContainer>
			<WallTitle
				title="Verification link unavailable"
				subtitle="Your account has not been changed by this link."
			/>
			<Alert color="orange" icon={TriangleAlert}>
				{message}
			</Alert>
			<div className="flex justify-end">
				<Button color="blue" onClick={state.canRetry ? retry : continueJourney}>
					{state.canRetry ? "Return to email setup" : "Log in"}
				</Button>
			</div>
		</WallContainer>
	);
}
