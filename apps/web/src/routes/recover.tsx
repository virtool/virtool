import { createFileRoute } from "@tanstack/react-router";
import RecoveryWall from "@wall/components/RecoveryWall";

export const Route = createFileRoute("/recover")({
	ssr: false,
	component: RecoveryWall,
});
