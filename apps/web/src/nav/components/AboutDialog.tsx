import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import ExternalLink from "@base/ExternalLink";

type AboutDialogProps = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

/**
 * Dialog showing the Virtool version and links to the changelog and
 * documentation.
 */
export default function AboutDialog({ open, setOpen }: AboutDialogProps) {
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTitle>About Virtool</DialogTitle>

				<section className="pb-6">
					<h3 className="font-medium pb-3 text-lg">Version</h3>
					<div className="font-mono">{__APP_VERSION__}</div>
					<ExternalLink
						className="block pt-3 text-blue-600 hover:underline"
						href={`https://www.virtool.ca/changelog/${__APP_VERSION__}`}
					>
						Changelog
					</ExternalLink>
				</section>

				<section className="border-t border-gray-200 pt-6">
					<h3 className="font-medium pb-2 text-lg">Documentation</h3>
					<p className="text-slate-600 pb-2">
						Guides for installing, configuring, and using Virtool.
					</p>
					<ExternalLink
						className="text-blue-600 hover:underline"
						href="https://www.virtool.ca/docs"
					>
						virtool.ca/docs
					</ExternalLink>
				</section>
			</DialogContent>
		</Dialog>
	);
}
