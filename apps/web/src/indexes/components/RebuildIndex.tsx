import Button, { buttonVariants } from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { type FormEvent, useState } from "react";
import { useCreateIndex, useFetchUnbuiltChanges } from "../queries";
import RebuildHistory from "./History";
import RebuildIndexError from "./RebuildIndexError";

type RebuildIndexProps = {
	referenceId: number;
};

/**
 * A "Create" button that opens a dialog for rebuilding the reference index.
 */
export default function RebuildIndex({ referenceId }: RebuildIndexProps) {
	const [open, setOpen] = useState(false);
	const { data, isError, isPending } = useFetchUnbuiltChanges(referenceId);
	const mutation = useCreateIndex();

	function handleSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		mutation.mutate(
			{ referenceId },
			{
				onSuccess: () => {
					setOpen(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger className={buttonVariants({ color: "blue" })}>
				Create
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Rebuild Index</DialogTitle>
				{isError && !data ? (
					<QueryError noun="unbuilt changes" />
				) : isPending ? (
					<LoadingPlaceholder />
				) : (
					<form onSubmit={handleSubmit}>
						<RebuildIndexError error={mutation.error?.message} />
						<RebuildHistory unbuilt={data} />
						<DialogFooter>
							<Button type="submit" color="blue" disabled={mutation.isPending}>
								Start
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
