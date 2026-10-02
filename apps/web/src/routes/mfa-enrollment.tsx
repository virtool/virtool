import { safeRedirect } from "@app/searchParams";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, redirect } from "@tanstack/react-router";
import MfaEnrollment from "@wall/components/MfaEnrollment";

type MfaEnrollmentSearch = {
	redirect?: string;
};

function validateSearch(
	input: Partial<MfaEnrollmentSearch> & SearchSchemaInput,
): MfaEnrollmentSearch {
	return {
		redirect: safeRedirect(input.redirect),
	};
}

export const Route = createFileRoute("/mfa-enrollment")({
	validateSearch,
	beforeLoad: async ({ context, search }) => {
		const { getAuthNextStepRoute, resolveAuthNextStep } = await import(
			"@wall/nextStep"
		);
		const step = await resolveAuthNextStep(context.queryClient);
		if (step.type !== "mfa_enrollment") {
			throw redirect({
				...getAuthNextStepRoute(step, search.redirect),
				replace: true,
			});
		}
	},
	component: MfaEnrollment,
});
