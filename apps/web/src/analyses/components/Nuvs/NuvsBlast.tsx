import { useBlastNuvs } from "@analyses/queries";
import type { BlastHit, FormattedNuvsHit } from "@analyses/types";
import { addSeconds, formatDistanceStrict } from "@app/date";
import { useNow } from "@app/hooks";
import Alert from "@base/Alert";
import Box from "@base/Box";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupTable from "@base/BoxGroupTable";
import Button from "@base/Button";
import ExternalLink from "@base/ExternalLink";
import Icon from "@base/Icon";
import Loader from "@base/Loader";
import RelativeTime from "@base/RelativeTime";
import { ExternalLink as ExternalLinkIcon, Info, Redo2 } from "lucide-react";

const ridRoot =
	"https://blast.ncbi.nlm.nih.gov/Blast.cgi?\
    CMD=Web&PAGE_TYPE=BlastFormatting&OLD_BLAST=false&GET_RID_INFO=on&RID=";

const identityFormatter = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function RidLink({ rid }: { rid: string }) {
	if (rid) {
		return (
			<span>
				<span> with RID </span>
				<ExternalLink href={ridRoot + rid}>
					{rid}{" "}
					<sup>
						<Icon icon={ExternalLinkIcon} />
					</sup>
				</ExternalLink>
			</span>
		);
	}

	return null;
}

type RidTimingProps = {
	interval: number;
	lastCheckedAt: Date;
};

function RidTiming({ interval, lastCheckedAt }: RidTimingProps) {
	const now = useNow();

	if (lastCheckedAt) {
		const nextCheckAt = addSeconds(lastCheckedAt, interval);
		const relativeNext = formatDistanceStrict(new Date(nextCheckAt), now);

		return (
			<div className="ml-auto text-gray-700">
				Last checked <RelativeTime time={lastCheckedAt} />. Checking again in{" "}
				{relativeNext}
			</div>
		);
	}

	return null;
}

type BlastPendingProps = {
	interval: number;
	lastCheckedAt: Date;
	rid: string;
};

function BlastPending({ interval, lastCheckedAt, rid }: BlastPendingProps) {
	return (
		<Box className="flex items-start [&>div:first-of-type]:mr-1">
			<Loader className="size-5" color="blue" />
			<div>
				<div>
					<span className="font-medium">BLAST in progress</span>
					<RidLink rid={rid} />
				</div>
				<RidTiming interval={interval} lastCheckedAt={lastCheckedAt} />
			</div>
		</Box>
	);
}

type BlastErrorProps = {
	error: string;
	onBlast: () => void;
};

function BlastError({ error, onBlast }: BlastErrorProps) {
	return (
		<Box className="flex items-center justify-between">
			<span>
				<strong>Error during BLAST request.</strong>
				<span> {error}</span>
			</span>
			<Button onClick={onBlast} color="blue">
				<Icon icon={Redo2} /> Retry
			</Button>
		</Box>
	);
}

type BlastResultsProps = {
	/** A list of the blast hits */
	hits: BlastHit[];

	/** Start a fresh request against NCBI */
	onBlast: () => void;
};

function BlastResults({ hits, onBlast }: BlastResultsProps) {
	const components = hits.map((hit) => (
		<tr key={hit.accession}>
			<td>
				<ExternalLink
					href={`https://www.ncbi.nlm.nih.gov/nuccore/${hit.accession}`}
				>
					{hit.accession}
				</ExternalLink>
			</td>
			<td>{hit.name}</td>
			<td>{hit.evalue}</td>
			<td>{hit.score}</td>
			<td>{identityFormatter.format(hit.identity / hit.align_len)}</td>
		</tr>
	));

	return (
		<BoxGroup>
			<BoxGroupHeader className="flex-row items-center justify-between px-4 py-2.5 [&_svg]:mr-1">
				<strong>NCBI BLAST</strong>
				<Button onClick={onBlast}>
					<Icon icon={Redo2} />
					Retry
				</Button>
			</BoxGroupHeader>
			<BoxGroupTable>
				<caption className="sr-only">BLAST hits</caption>
				<thead>
					<tr>
						<th scope="col">Accession</th>
						<th scope="col">Name</th>
						<th scope="col">E-value</th>
						<th scope="col">Score</th>
						<th scope="col">Identity</th>
					</tr>
				</thead>
				<tbody>{components}</tbody>
			</BoxGroupTable>
		</BoxGroup>
	);
}

type NuVsBLASTProps = {
	analysisId: number;

	/** Complete information for a Nuvs hit */
	hit: FormattedNuvsHit;
};

/**
 * A contig's BLAST request against NCBI, in whichever state it is in: absent,
 * in progress, failed, or returned.
 */
export default function NuvsBlast({ analysisId, hit }: NuVsBLASTProps) {
	const { blast, index } = hit;
	const mutation = useBlastNuvs(analysisId);

	function handleBlast() {
		mutation.mutate({ sequenceIndex: index });
	}

	if (blast) {
		if (blast.error) {
			return <BlastError error={blast.error} onBlast={handleBlast} />;
		}

		if (blast.ready) {
			if (blast.result?.hits.length) {
				return <BlastResults hits={blast.result.hits} onBlast={handleBlast} />;
			}

			return (
				<Box>
					<h4 className="font-medium mt-1 mb-4">NCBI BLAST</h4>
					<p>No BLAST hits found.</p>
				</Box>
			);
		}

		return (
			<BlastPending
				interval={blast.interval ?? 0}
				lastCheckedAt={blast.lastCheckedAt}
				rid={blast.rid ?? ""}
			/>
		);
	}

	return (
		<Alert color="purple" level icon={Info}>
			<span>This sequence has no BLAST information attached to it.</span>
			<Button className="ml-auto" color="purple" onClick={handleBlast}>
				BLAST at NCBI
			</Button>
		</Alert>
	);
}
