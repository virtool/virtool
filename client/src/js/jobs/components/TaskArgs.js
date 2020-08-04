import PropTypes from "prop-types";
import React from "react";
import { Link } from "react-router-dom";
import { BoxGroup, BoxGroupHeader, Table } from "../../base";

const TaskArgsRow = ({ children, title }) => (
    <tr>
        <th>{title}</th>
        <td>{children}</td>
    </tr>
);

export const AnalysisRows = ({ sample_id, analysis_id }) => (
    <React.Fragment>
        <TaskArgsRow title="Sample">
            <Link to={`/samples/${sample_id}`}>{sample_id}</Link>
        </TaskArgsRow>
        <TaskArgsRow title="Analysis">
            <Link to={`/samples/${sample_id}/analyses/${analysis_id}`}>{analysis_id}</Link>
        </TaskArgsRow>
    </React.Fragment>
);

export const BuildIndexRows = ({ index_id, ref_id }) => (
    <React.Fragment>
        <TaskArgsRow title="Reference">
            <Link to={`/refs/${ref_id}`}>{ref_id}</Link>
        </TaskArgsRow>
        <TaskArgsRow title="Index">
            <Link to={`/refs/${ref_id}/indexes/${index_id}`}>{index_id}</Link>
        </TaskArgsRow>
    </React.Fragment>
);

export const CreateSampleRows = ({ sample_id }) => (
    <React.Fragment>
        <TaskArgsRow title="Sample">
            <Link to={`/samples/${sample_id}`}>{sample_id}</Link>
        </TaskArgsRow>
    </React.Fragment>
);

export const CreateSubtractionRows = ({ subtraction_id }) => (
    <TaskArgsRow title="Subtraction">
        <Link to={`/subtraction/${subtraction_id}`}>{subtraction_id}</Link>
    </TaskArgsRow>
);

export const UpdateSampleRows = ({ sample_id }) => (
    <TaskArgsRow title="Subtraction">
        <Link to={`/samples/${sample_id}`}>{sample_id}</Link>
    </TaskArgsRow>
);

export const TaskArgsRows = ({ taskType, taskArgs }) => {
    switch (taskType) {
        case "build_index":
            return <BuildIndexRows {...taskArgs} />;

        case "create_sample":
            return <CreateSampleRows {...taskArgs} />;

        case "create_subtraction":
            return <CreateSubtractionRows {...taskArgs} />;

        case "aodp":
        case "nuvs":
        case "pathoscope_bowtie":
            return <AnalysisRows {...taskArgs} />;

        case "update_sample":
            return <UpdateSampleRows {...taskArgs} />;
    }
};

export const TaskArgs = props => (
    <BoxGroup>
        <BoxGroupHeader>
            <h2>Arguments</h2>
            <p>Run arguments that make this job unique.</p>
        </BoxGroupHeader>
        <Table>
            <tbody>
                <TaskArgsRows {...props} />
            </tbody>
        </Table>
    </BoxGroup>
);

TaskArgs.propTypes = {
    taskType: PropTypes.string.isRequired,
    taskArgs: PropTypes.object.isRequired
};
