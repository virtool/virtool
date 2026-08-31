import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/refs/beta/$referenceId/")(
	{
		beforeLoad: () => {
			throw Route.redirect({ to: "/refs/beta/$referenceId/general" });
		},
	},
);
