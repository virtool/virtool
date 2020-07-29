import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize } from "../../../app/theme";
import { AffixedProgressBar, Attribution, LinkBox } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";
import { cancelJob, removeJob } from "../../actions";
import { JobAction } from "./Action";
import { JobStatus } from "./Status";

const JobItemBody = styled.div`
    font-size: ${getFontSize("lg")};
    padding: 10px 15px;
    position: relative;

    ${Attribution} {
        font-size: ${getFontSize("md")};
    }
`;

const JobItemContainer = styled.div`
    position: relative;
`;

const JobItemHeader = styled.div`
    align-items: center;
    display: flex;
    position: relative;
`;

const JobItemLinkBox = styled(LinkBox)`
    padding: 5px 0 0 0;
    position: relative;
`;

export const JobItem = ({ id, task, state, progress, created_at, user, canCancel, canRemove, onCancel, onRemove }) => {
    const handleCancel = useCallback(() => onCancel(id), [id, onCancel]);
    const handleRemove = useCallback(() => onRemove(id), [id, onRemove]);

    const progressValue = progress * 100;

    let progressColor = "green";

    if (state === "running") {
        progressColor = "blue";
    }

    if (state === "error" || state === "cancelled") {
        progressColor = "red";
    }

    // Create the option components for the selected fields.
    return (
        <JobItemContainer>
            <JobItemLinkBox to={`/jobs/${id}`}>
                <AffixedProgressBar now={progressValue} color={progressColor} />

                <JobItemBody>
                    <JobItemHeader>
                        <strong>{getTaskDisplayName(task)}</strong>
                        <JobStatus state={state} pad={canCancel || canRemove} />
                    </JobItemHeader>
                    <Attribution time={created_at} user={user.id} />
                </JobItemBody>
            </JobItemLinkBox>
            <JobAction
                key={state}
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

export default connect(null, mapDispatchToProps)(JobItem);
