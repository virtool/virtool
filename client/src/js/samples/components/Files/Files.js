import React, { useEffect } from "react";
import { connect } from "react-redux";
import { getLinkedJob } from "../../../jobs/actions";
import { getHasRawFilesOnly } from "../../selectors";
import SampleFilesCache from "./Cache";
import SampleFilesMessage from "./LegacyAlert";
import SampleFilesRaw from "./Raw";

const SampleDetailFiles = ({ onGetJob, jobId, sampleId }) => {
    useEffect(() => {
        if (jobId) {
            onGetJob(jobId);
        }
    }, [sampleId]);

    return (
        <div>
            <SampleFilesMessage />
            <SampleFilesRaw />
            <SampleFilesCache />
        </div>
    );
};

const mapStateToProps = state => {
    let jobId;

    if (!getHasRawFilesOnly(state)) {
        jobId = state.samples.detail.update_job.id;
    }

    return {
        jobId,
        sampleId: state.samples.detail.id
    };
};

const mapDispatchToProps = dispatch => ({
    onGetJob: jobId => {
        dispatch(getLinkedJob(jobId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleDetailFiles);
