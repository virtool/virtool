import { useFetchEmailSettings } from "@administration/queries";
import { BoxGroup } from "@base/Box";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useState } from "react";
import EmailApiKey from "./EmailApiKey";
import EmailDeliveryStatus from "./EmailDeliveryStatus";
import EmailDeliverySending from "./EmailDeliverySending";
import EmailSender from "./EmailSender";
import EmailTest from "./EmailTest";

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
			<SectionHeader className="mb-0" level={2}>
				<h2>Email Delivery</h2>
				<p>Send account setup, verification, and password recovery mail.</p>
			</SectionHeader>
			<EmailDeliveryStatus settings={data} />
			<section>
				<SectionHeader level={3}>
					<h3>Sending</h3>
					<p>Choose whether queued email is sent.</p>
				</SectionHeader>
				<BoxGroup>
					<EmailDeliverySending settings={data} />
					<EmailTest resetToken={testResetToken} settings={data} />
				</BoxGroup>
			</section>
			<section>
				<SectionHeader level={3}>
					<h3>Resend API Key</h3>
				</SectionHeader>
				<EmailApiKey settings={data} />
			</section>
			<section>
				<SectionHeader level={3}>
					<h3>Sender</h3>
					<p>Configure the identity used for outgoing email.</p>
				</SectionHeader>
				<EmailSender
					onSaved={() => setTestResetToken((token) => token + 1)}
					settings={data}
				/>
			</section>
		</section>
	);
}
