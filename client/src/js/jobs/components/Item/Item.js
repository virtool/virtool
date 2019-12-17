import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Attribution, LinkBox, ProgressBar } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";
import { cancelJob, removeJob } from "../../actions";
import { JobAction } from "./Action";
import { JobStatus } from "./Status";

const JobItemBody = styled.div`
    padding: 10px 15px;

    ${Attribution} {
        font-size: 12px;
    }
`;

const JobItemContainer = styled.div`
    position: relative;
`;

const JobItemHeader = styled.div`
    align-items: center;
    display: flex;
`;

const JobItemLinkBox = styled(LinkBox)`
    padding: 0;
`;

export const JobItem = ({ id, task, state, progress, created_at, user, canCancel, canRemove, onCancel, onRemove }) => {
    const handleCancel = useCallback(() => onCancel(id), [id, canCancel]);
    const handleRemove = useCallback(() => onRemove(id), [id, canRemove]);

    let progressStyle = "success";

    const progressValue = progress * 100;

    if (state === "running") {
        progressStyle = "warning";
    }

    if (state === "error" || state === "cancelled") {
        progressStyle = "danger";
    }

    // Create the option components for the selected fields.
    return (
        <JobItemContainer>
            <JobItemLinkBox to={`/jobs/${id}`}>
                <ProgressBar now={progressValue} bsStyle={progressStyle} affixed />
                <JobItemBody>
                    <JobItemHeader>
                        <strong>{getTaskDisplayName(task)}</strong>
                        <JobStatus state={state} pad={canCancel || canRemove} />
                    </JobItemHeader>
                    <Attribution time={created_at} user={user.id} />
                </JobItemBody>
            </JobItemLinkBox>
            <JobAction
                state={state}
                canCancel={canCancel}
                canRemove={canRemove}
                onCancel={handleCancel}
                onRemove={handleRemove}
            />
        </JobItemContainer>
    );
};

export const mapDispatchToProps = dispatch => ({
    onCancel: jobId => {
        dispatch(cancelJob(jobId));
    },

    onRemove: jobId => {
        dispatch(removeJob(jobId));
    }
});

export default connect(
    null,
    mapDispatchToProps
)(JobItem);
