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

	return (
		<WallContainer>
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
			{passwordResetRequired || isResetRequired ? (
				<ResetForm redirect={redirect} />
			) : (
				<LoginForm redirect={redirect} setResetRequired={setIsResetRequired} />
			)}
		</WallContainer>
	);
}
