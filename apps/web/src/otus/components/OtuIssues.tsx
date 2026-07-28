import { formatIsolateName } from "@app/utils";
import Alert from "@base/Alert";
import type { OtuIsolate, OtuIssueReport } from "@virtool/contracts";
import type { ReactNode } from "react";

type OtuIssuesProps = {
	/** The isolates associated with the OTU */
	isolates: OtuIsolate[];
	/** The issues that occurred */
	issues: OtuIssueReport;
};

/**
 * Displays a message of any issues that occurred for the OTU
 */
export default function OtuIssues({ isolates, issues }: OtuIssuesProps) {
	const errors: ReactNode[] = [];

	// The OTU has no isolates associated with it.
	if (issues.emptyOtu) {
		errors.push(
			<li key="emptyOtu">There are no isolates associated with this OTU</li>,
		);
	}

	// The OTU has an inconsistent number of sequences between isolates.
	if (issues.isolateInconsistency) {
		errors.push(
			<li key="isolateInconsistency">
				Some isolates have different numbers of sequences than other isolates
			</li>,
		);
	}

	// One or more isolates have no sequences associated with them.
	if (issues.emptyIsolate) {
		const emptyIsolates = issues.emptyIsolate.map((isolateId) => {
			const isolate = isolates.find((i) => i.id === isolateId);

			return (
				<li key={isolateId}>
					{isolate ? formatIsolateName(isolate) : "Unknown isolate"}
				</li>
			);
		});

		errors.push(
			<li key="emptyIsolate">
				There are no sequences associated with the following isolates:
				<ul>{emptyIsolates}</ul>
			</li>,
		);
	}

	// One or more sequence documents have no sequence field.
	if (issues.emptySequence) {
		const emptySequences = issues.emptySequence.map((emptySequence) => {
			const isolate = isolates.find((i) => i.id === emptySequence.isolateId);

			return (
				<li key={emptySequence.id}>
					<span>
						<em>{emptySequence.id}</em> in isolate{" "}
						<em>{isolate ? formatIsolateName(isolate) : "Unknown isolate"}</em>
					</span>
				</li>
			);
		});

		errors.push(
			<li key="emptySequence">
				There are sequence records with undefined <code>sequence</code> fields:
				<ul>{emptySequences}</ul>
			</li>,
		);
	}

	return (
		<Alert color="orange" block>
			<h5 className="font-bold mt-0 mb-4">
				There are some issues that must be resolved before this OTU can be
				included in the next index build
			</h5>
			<ul className="mt-0 mb-2.5">{errors}</ul>
		</Alert>
	);
}
