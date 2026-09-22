import { createFileRoute } from "@tanstack/react-router";
import EmailVerificationWall from "@wall/components/EmailVerificationWall";

export const Route = createFileRoute("/verify-email")({
	ssr: false,
	component: EmailVerificationWall,
});
