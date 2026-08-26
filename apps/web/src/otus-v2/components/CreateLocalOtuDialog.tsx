import Badge from "@base/Badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@base/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base/Tabs";
import CreateLocalOtuForm from "@otus-v2/components/CreateLocalOtuForm";
import CreateLocalOtuFromAccessionForm from "@otus-v2/components/CreateLocalOtuFromAccessionForm";

/** A dialog to create one complete local OTU from GenBank accessions or by hand. */
export default function CreateLocalOtuDialog({
	open,
	setOpen,
	referenceId,
	defaultSegmentLengthTolerance,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
	referenceId: string;
	defaultSegmentLengthTolerance: number;
}) {
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTitle>
					Create OTU <Badge color="purple">Beta</Badge>
				</DialogTitle>
				<DialogDescription>Create one complete local OTU.</DialogDescription>

				<Tabs defaultValue="genbank">
					<TabsList>
						<TabsTrigger value="genbank">GenBank</TabsTrigger>
						<TabsTrigger value="manual">Manual</TabsTrigger>
					</TabsList>

					<TabsContent value="genbank">
						<CreateLocalOtuFromAccessionForm
							referenceId={referenceId}
							defaultSegmentLengthTolerance={defaultSegmentLengthTolerance}
						/>
					</TabsContent>

					<TabsContent value="manual">
						<CreateLocalOtuForm
							referenceId={referenceId}
							defaultSegmentLengthTolerance={defaultSegmentLengthTolerance}
						/>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
