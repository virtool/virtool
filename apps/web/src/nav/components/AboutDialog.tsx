import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import ExternalLink from "@base/ExternalLink";
import { useRootQuery } from "@nav/queries";

type AboutDialogProps = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

/**
 * Dialog showing the Virtool server and web app versions and a link to the
 * documentation.
 */
export default function AboutDialog({ open, setOpen }: AboutDialogProps) {
	const { data } = useRootQuery();

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTitle>About Virtool</DialogTitle>
				<p className="text-slate-600 pb-6">
					Virtool is made up of a server and a web app that are released
					independently.
				</p>

				<section className="pb-6">
					<h3 className="font-medium pb-3 text-lg">Versions</h3>
					<dl className="space-y-3">
						<div className="flex">
							<dt className="font-medium w-32 shrink-0">Server</dt>
							<dd>
								<div className="font-mono">{data?.version ?? "—"}</div>
								<div className="text-slate-600 text-sm">
									Stores data and runs analyses.
								</div>
							</dd>
						</div>
						<div className="flex">
							<dt className="font-medium w-32 shrink-0">Web app</dt>
							<dd>
								<div className="font-mono">{__APP_VERSION__}</div>
								<div className="text-slate-600 text-sm">
									Runs in your browser to interact with the server.
								</div>
							</dd>
						</div>
					</dl>
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
