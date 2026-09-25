import { cn } from "@app/cn";
import Link from "@base/Link";

/** How an administrator hands an invitation link to its recipient. */
export type DeliveryIntent = "copy_only" | "email";

type DeliveryIntentFieldProps = {
	name: string;
	value: DeliveryIntent;
	onChange: (value: DeliveryIntent) => void;
	emailDeliveryAvailable: boolean;
	canConfigureEmailDelivery: boolean;
};

/** A choice between emailing an invitation and sharing its link by hand. */
export function DeliveryIntentField({
	name,
	value,
	onChange,
	emailDeliveryAvailable,
	canConfigureEmailDelivery,
}: DeliveryIntentFieldProps) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-2 font-medium">Invitation delivery</legend>
			<div>
				<label
					className={cn(
						"flex items-start gap-2",
						!emailDeliveryAvailable && "cursor-not-allowed text-gray-500",
					)}
				>
					<input
						className="mt-1 shrink-0"
						type="radio"
						name={name}
						value="email"
						checked={value === "email"}
						disabled={!emailDeliveryAvailable}
						onChange={() => onChange("email")}
					/>
					<span>
						<span className="block font-medium">Email invitation</span>
						<span
							className={`block text-sm ${emailDeliveryAvailable ? "text-gray-600" : "text-gray-500"}`}
						>
							{emailDeliveryAvailable
								? "Send the setup link to this email address."
								: "Email invitations aren’t configured."}
						</span>
					</span>
				</label>
				{!emailDeliveryAvailable && canConfigureEmailDelivery && (
					<Link
						className="ml-6 text-sm text-blue-600 underline"
						to="/administration/email"
					>
						Configure email delivery
					</Link>
				)}
			</div>
			<label className="flex items-start gap-2">
				<input
					className="mt-1 shrink-0"
					type="radio"
					name={name}
					value="copy_only"
					checked={value === "copy_only"}
					onChange={() => onChange("copy_only")}
				/>
				<span>
					<span className="block font-medium">Create shareable link</span>
					<span className="block text-sm text-gray-600">
						You’ll need to send the link yourself.
					</span>
				</span>
			</label>
		</fieldset>
	);
}
