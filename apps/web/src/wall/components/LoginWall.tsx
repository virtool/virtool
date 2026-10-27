import Alert from "@base/Alert";
import { getRouteApi } from "@tanstack/react-router";
import { Info, TriangleAlert } from "lucide-react";
import { useState } from "react";
import LoginForm from "./LoginForm";
import ResetForm from "./ResetForm";
import { WallContainer } from "./WallContainer";

const loginRouteApi = getRouteApi("/login");

export default function LoginWall() {
	const { passwordResetRequired } = loginRouteApi.useRouteContext();
	// The route context changes without a remount when a route guard sends a
	// signed-in user who must reset their password back to this route.
	const [isResetRequired, setIsResetRequired] = useState(false);
	const { reason, redirect } = loginRouteApi.useSearch();
	const navigate = loginRouteApi.useNavigate();

	// The reason explains the first sign-in step. It is stale once the password
	// is accepted, and must not come back if the page reloads.
	function clearReason() {
		if (reason) {
			void navigate({ search: { redirect }, replace: true });
		}
	}

	if (passwordResetRequired || isResetRequired) {
		return (
			<WallContainer>
				<ResetForm redirect={redirect} />
			</WallContainer>
		);
	}

	return (
		<WallContainer>
			<LoginForm
				notice={
					<>
						{reason === "remediation-expired" && (
							<Alert color="orange" icon={TriangleAlert} level>
								Your email setup expired. Sign in again to continue.
							</Alert>
						)}
						{reason === "setup-complete" && (
							<Alert color="blue" icon={Info} level>
								Virtool is already set up. Sign in to continue.
							</Alert>
						)}
						{reason === "session-ended" && (
							<Alert color="orange" icon={TriangleAlert} level>
								Your session ended. Sign in again.
							</Alert>
						)}
					</>
				}
				onChallenge={clearReason}
				redirect={redirect}
				setResetRequired={setIsResetRequired}
			/>
		</WallContainer>
	);
}
