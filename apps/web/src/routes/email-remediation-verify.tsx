import { createFileRoute } from "@tanstack/react-router";
import EmailRemediationVerification from "@wall/components/EmailRemediationVerification";

export const Route = createFileRoute("/email-remediation-verify")({
	ssr: false,
	component: EmailRemediationVerification,
});
