import { useFetchEmailSettings } from "@administration/queries";
import ExternalLink from "@base/ExternalLink";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useState } from "react";
import EmailApiKey from "./EmailApiKey";
import EmailDeliveryStatus from "./EmailDeliveryStatus";
import EmailSender from "./EmailSender";
import EmailTest from "./EmailTest";

const RESEND_DOMAINS_DOCS =
	"https://resend.com/docs/dashboard/domains/introduction";

/**
 * Configure how this instance sends transactional email.
 *
 * Rendered only for full administrators. Every server function behind it
 * demands that role of its own accord, so this gate is presentation: it keeps
 * a lesser administrator from issuing requests that would only be refused.
 *
 * Each action below is its own form and its own mutation, so saving the sender
 * identity cannot carry a half-typed API key, and a test send cannot carry
 * either.
 */
export default function EmailDelivery() {
	const { data, isPending, isError } = useFetchEmailSettings();
	const [testResetToken, setTestResetToken] = useState(0);

	if (isError && !data) {
		return <QueryError noun="email settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	return (
		<section className="flex flex-col gap-4">
			<SectionHeader className="mb-0">
				<h2>Email Delivery</h2>
				<p>
					Send account setup, verification, and password recovery mail through
					Resend. Delivery needs a Resend API key and a{" "}
					<ExternalLink className="underline" href={RESEND_DOMAINS_DOCS}>
						verified sending domain
					</ExternalLink>
					. While delivery is unavailable, the authentication views still offer
					copyable setup links.
				</p>
			</SectionHeader>
			<EmailDeliveryStatus settings={data} />
			<EmailSender
				onSaved={() => setTestResetToken((token) => token + 1)}
				settings={data}
			/>
			<EmailApiKey settings={data} />
			<EmailTest resetToken={testResetToken} settings={data} />
		</section>
	);
}
