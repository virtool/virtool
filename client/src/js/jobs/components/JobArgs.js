import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import { BoxGroup, BoxGroupHeader, Table } from "../../base";

const JobArgsRow = ({ children, title }) => (
    <tr>
        <th>{title}</th>
        <td>{children}</td>
    </tr>
);

export const AnalysisRows = ({ sample_id, analysis_id }) => (
    <React.Fragment>
        <JobArgsRow title="Sample">
            <Link to={`/samples/${sample_id}`}>{sample_id}</Link>
        </JobArgsRow>
        <JobArgsRow title="Analysis">
            <Link to={`/samples/${sample_id}/analyses/${analysis_id}`}>{analysis_id}</Link>
        </JobArgsRow>
    </React.Fragment>
);

export const BuildIndexRows = ({ index_id, ref_id }) => (
    <React.Fragment>
        <JobArgsRow title="Reference">
            <Link to={`/refs/${ref_id}`}>{ref_id}</Link>
        </JobArgsRow>
        <JobArgsRow title="Index">
            <Link to={`/refs/${ref_id}/indexes/${index_id}`}>{index_id}</Link>
        </JobArgsRow>
    </React.Fragment>
);

export const CreateSampleRows = ({ sample_id }) => (
    <React.Fragment>
        <JobArgsRow title="Sample">
            <Link to={`/samples/${sample_id}`}>{sample_id}</Link>
        </JobArgsRow>
    </React.Fragment>
);

export const CreateSubtractionRows = ({ subtraction_id }) => (
    <JobArgsRow title="Subtraction">
        <Link to={`/subtraction/${subtraction_id}`}>{subtraction_id}</Link>
    </JobArgsRow>
);

export const UpdateSampleRows = ({ sample_id }) => (
    <JobArgsRow title="Subtraction">
        <Link to={`/samples/${sample_id}`}>{sample_id}</Link>
    </JobArgsRow>
);

export const JobArgsRows = ({ workflow, args }) => {
    switch (workflow) {
        case "build_index":
            return <BuildIndexRows {...args} />;

        case "create_sample":
            return <CreateSampleRows {...args} />;

        case "create_subtraction":
            return <CreateSubtractionRows {...args} />;

        case "aodp":
        case "nuvs":
        case "pathoscope_bowtie":
            return <AnalysisRows {...args} />;

        case "update_sample":
            return <UpdateSampleRows {...args} />;
    }
};

export const JobArgs = props => (
    <BoxGroup>
        <BoxGroupHeader>
            <h2>Arguments</h2>
            <p>Run arguments that make this job unique.</p>
        </BoxGroupHeader>
        <Table>
            <tbody>
                <JobArgsRows {...props} />
            </tbody>
        </Table>
    </BoxGroup>
);

JobArgs.propTypes = {
    workflow: PropTypes.string.isRequired,
    args: PropTypes.object.isRequired
};
