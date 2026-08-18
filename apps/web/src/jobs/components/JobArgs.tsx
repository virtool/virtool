import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupSection from "@base/BoxGroupSection";
import Link from "@base/Link";
import type { ReactNode } from "react";
import AnalysisPeek from "./AnalysisPeek";

type JobArgsRowProps = {
	/** What to display as the value of the argument */
	children: ReactNode;

	/** The name of the job argument */
	title: string;

	/** A short explanation of the argument */
	description?: string;

	/** An optional class name to apply to the row */
	className?: string;
};

/** A single card showing a job argument. */
function JobArgsRow({
	children,
	title,
	description,
	className,
}: JobArgsRowProps) {
	return (
		<BoxGroupSection
			className={`flex items-center justify-between gap-4 ${className ?? ""}`}
		>
			<div>
				<span className="font-medium">{title}</span>
				{description ? (
					<p className="m-0 text-gray-500">{description}</p>
				) : null}
			</div>
			<div className="text-right">{children}</div>
		</BoxGroupSection>
	);
}

type BuildIndexRowsProps = {
	/** The unique identifier of the index being built */
	index_id: string;

	/** The unique identifier of the reference the index is based on */
	ref_id: string;
};

/** Rows showing important arguments when running a "build_index" workflow. */
function BuildIndexRows({ index_id, ref_id }: BuildIndexRowsProps) {
	return (
		<>
			<JobArgsRow
				title="Reference"
				description="Reference used to build the index"
			>
				<Link to="/refs/$refId" params={{ refId: ref_id }}>
					{ref_id}
				</Link>
			</JobArgsRow>
			<JobArgsRow title="Index" description="Index built by this job">
				<Link
					to="/refs/$refId/indexes/$indexId"
					params={{ refId: ref_id, indexId: index_id }}
				>
					{index_id}
				</Link>
			</JobArgsRow>
		</>
	);
}

type CreateSampleRowsProps = {
	/** the unique identifier of the sample being created*/
	sample_id: string;
};

/** Rows showing important arguments when running an "create_sample" workflow. */
function CreateSampleRows({ sample_id }: CreateSampleRowsProps) {
	return (
		<JobArgsRow title="Sample" description="Sample created by this job">
			<Link to="/samples/$sampleId" params={{ sampleId: sample_id }}>
				{sample_id}
			</Link>
		</JobArgsRow>
	);
}

type CreateSubtractionRowsProps = {
	/** the unique identifier of the created subtraction */
	subtraction_id: string;
};

/** Rows showing important arguments when running a "create_subtraction" workflow. */
function CreateSubtractionRows({ subtraction_id }: CreateSubtractionRowsProps) {
	return (
		<JobArgsRow
			title="Subtraction"
			description="Subtraction created by this job"
		>
			<Link
				to="/subtractions/$subtractionId"
				params={{ subtractionId: subtraction_id }}
			>
				{subtraction_id}
			</Link>
		</JobArgsRow>
	);
}

type UnknownJobRows = {
	/** The list of arguments used to run the job */
	args: object;
};

/** Generic rows displaying the arguments passed to the job when the workflow type is not known. */
function UnknownJobRows({ args }: UnknownJobRows) {
	return (
		<>
			{Object.entries(args).map(([key, value]): ReactNode => {
				if (typeof value === "string" || typeof value === "number") {
					return (
						<JobArgsRow className="font-mono font-normal" key={key} title={key}>
							{value}
						</JobArgsRow>
					);
				}
				return null;
			})}
		</>
	);
}

type GenericJobArgsProps<workflowType, argsType> = {
	workflow: workflowType;
	args: argsType;
};

type JobArgsRowsProps =
	| GenericJobArgsProps<"build_index", BuildIndexRowsProps>
	| GenericJobArgsProps<"create_sample", CreateSampleRowsProps>
	| GenericJobArgsProps<"create_subtraction", CreateSubtractionRowsProps>;

/**  The table rows containing arguments used to run a job. */
function JobArgsRows({ workflow, args }: JobArgsRowsProps) {
	switch (workflow) {
		case "build_index":
			return <BuildIndexRows {...args} />;

		case "create_sample":
			return <CreateSampleRows {...args} />;

		case "create_subtraction":
			return <CreateSubtractionRows {...args} />;

		default:
			return <UnknownJobRows args={args} />;
	}
}

type JobArgsProps = {
	workflow: string;
	args: Record<string, unknown>;
};

/** A table of arguments used to run a job. */
export default function JobArgs({ workflow, args }: JobArgsProps) {
	if (workflow === "pathoscope" || workflow === "nuvs") {
		return <AnalysisPeek analysisId={Number(args.analysis_id)} />;
	}

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2>Arguments</h2>
				<p>Run arguments that make this job unique.</p>
			</BoxGroupHeader>
			{/* The API returns args as an untyped record; JobArgsRows narrows
			    them per workflow. */}
			<JobArgsRows {...({ workflow, args } as JobArgsRowsProps)} />
		</BoxGroup>
	);
}
