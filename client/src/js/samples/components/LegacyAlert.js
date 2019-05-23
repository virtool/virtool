import { connect } from "react-redux";
import { get, last } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { Alert, ProgressBar } from "react-bootstrap";
import { Link } from "react-router-dom";
import { Box, BoxTitle, Flex } from "../../base";
import { getHasRawFilesOnly, getSampleUpdateJobId } from "../selectors";

const SampleFilesJobStatus = styled.span`
    color: #777777;
    font-size: 12px;
    text-transform: uppercase;
`;

const updateJobInProgress = "Update job in progress";

export const SampleFilesJobMessage = ({ job }) => {
    let link;
    let progress = 0;
    let status;

    if (job) {
        const latest = last(job.status);
        link = <Link to={`/jobs/${job.id}`}>{updateJobInProgress}</Link>;
        progress = latest.progress * 100;
        status = latest.state;
    } else {
        link = <span>{updateJobInProgress}</span>;
        status = "Waiting";
    }

    return (
        <Box>
            <BoxTitle>
                <Flex alignItems="flex-end" justifyContent="space-between">
                    {link}
                    <SampleFilesJobStatus>{status}</SampleFilesJobStatus>
                </Flex>
            </BoxTitle>
            <ProgressBar now={progress} />
        </Box>
    );
};

export const SampleFilesLegacyAlert = () => (
    <Alert bsStyle="warning">
        <p className="text-strong">
            Virtool now retains raw data for newly created samples instead of trimming during sample creation.
        </p>
        <p>
            Because this is an older sample, only trimmed data is available. You can upload the original sample files by
            dragging them onto the trimmed files they should replace.
        </p>
        <p>
            When replacements have been uploaded for all data files, an update job will start. No new analyses can be
            started for the sample during this time.
        </p>
        <p>QC charts are based on trimmed data for older samples and raw data for post-3.4.0 samples.</p>
        <p>
            <a target="_blank" rel="noopener noreferrer" href="https://www.virtool.ca/docs">
                More information
            </a>
        </p>
    </Alert>
);

export const SampleFilesMessage = ({ job, showJob, showLegacy }) => {
    if (showJob) {
        return <SampleFilesJobMessage job={job} />;
    }
    if (showLegacy) {
        return <SampleFilesLegacyAlert />;
    }

    return null;
};

const mapStateToProps = state => {
    const hasRawFilesOnly = getHasRawFilesOnly(state);
    const jobId = getSampleUpdateJobId(state);
    const job = get(state, ["jobs", "linkedJobs", jobId]);

    return {
        job,
        showJob: !!jobId,
        showLegacy: !hasRawFilesOnly
    };
};

export default connect(mapStateToProps)(SampleFilesMessage);
