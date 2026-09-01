import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/refs/alpha/$referenceId/",
)({
	beforeLoad: () => {
		throw Route.redirect({ to: "/refs/alpha/$referenceId/general" });
	},
});
