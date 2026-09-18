import Alert from "@base/Alert";
import { getRouteApi } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import LoginForm from "./LoginForm";
import ResetForm from "./ResetForm";
import { WallContainer } from "./WallContainer";

const loginRouteApi = getRouteApi("/login");

export default function LoginWall() {
	const { passwordResetRequired } = loginRouteApi.useRouteContext();
	const [isResetRequired, setIsResetRequired] = useState(
		passwordResetRequired ?? false,
	);
	const { reason, redirect } = loginRouteApi.useSearch();

	return (
		<WallContainer>
			{reason === "remediation-expired" && (
				<Alert color="orange" icon={TriangleAlert} level>
					Your email setup expired. Log in again to continue.
				</Alert>
			)}
			{reason === "session-ended" && (
				<Alert color="orange" icon={TriangleAlert} level>
					Your session ended. Please log in again.
				</Alert>
			)}
			{isResetRequired ? (
				<ResetForm redirect={redirect} />
			) : (
				<LoginForm redirect={redirect} setResetRequired={setIsResetRequired} />
			)}
		</WallContainer>
	);
}
