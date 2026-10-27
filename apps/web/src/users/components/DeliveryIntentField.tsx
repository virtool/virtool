import { cn } from "@app/cn";
import Field, {
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "@base/Field";
import Link from "@base/Link";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";

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
		<FieldSet>
			<FieldLegend variant="label">Invitation delivery</FieldLegend>
			<RadioGroup
				name={name}
				value={value}
				onValueChange={(next) => onChange(next as DeliveryIntent)}
			>
				<div>
					<FieldLabel
						className={cn(
							!emailDeliveryAvailable && "cursor-not-allowed text-gray-500",
						)}
						variant="card"
					>
						<Field orientation="horizontal" className="items-start">
							<RadioGroupItem
								className="mt-0.5"
								value="email"
								disabled={!emailDeliveryAvailable}
							/>
							<FieldContent>
								<FieldTitle>Email invitation</FieldTitle>
								<FieldDescription
									className={cn(!emailDeliveryAvailable && "text-gray-500")}
								>
									{emailDeliveryAvailable
										? "Send the setup link to this email address."
										: "Email invitations aren’t configured."}
								</FieldDescription>
							</FieldContent>
						</Field>
					</FieldLabel>
					{!emailDeliveryAvailable && canConfigureEmailDelivery && (
						<Link
							className="mt-1 inline-block text-sm text-blue-600 underline"
							to="/administration/email"
						>
							Configure email delivery
						</Link>
					)}
				</div>
				<FieldLabel variant="card">
					<Field orientation="horizontal" className="items-start">
						<RadioGroupItem className="mt-0.5" value="copy_only" />
						<FieldContent>
							<FieldTitle>Create shareable link</FieldTitle>
							<FieldDescription>
								You’ll need to send the link yourself.
							</FieldDescription>
						</FieldContent>
					</Field>
				</FieldLabel>
			</RadioGroup>
		</FieldSet>
	);
}
