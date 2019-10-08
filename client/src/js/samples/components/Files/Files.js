import { get } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import { getLinkedJob } from "../../../jobs/actions";
import SampleFilesMessage from "../LegacyAlert";
import SampleFileSizeWarning from "../SampleFileSizeWarning.js";
import SampleFilesCache from "./Cache";
import SampleFilesRaw from "./Raw";

const SampleDetailFiles = ({ onGetJob, jobId }) => {
    useEffect(() => {
        if (jobId) {
            onGetJob(jobId);
        }
    }, [jobId]);

    return (
        <div>
            <SampleFileSizeWarning />
            <SampleFilesMessage />
            <SampleFilesRaw />
            <SampleFilesCache />
        </div>
    );
};

const mapStateToProps = state => ({
    jobId: get(state, "samples.detail.update_job.id")
});

const mapDispatchToProps = dispatch => ({
    onGetJob: jobId => {
        dispatch(getLinkedJob(jobId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleDetailFiles);
