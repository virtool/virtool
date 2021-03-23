import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Icon } from "../../base";
import { getCanModifyReferenceOTU, getDataType } from "../../references/selectors";
import { getUnreferencedTargets } from "../selectors";

const AddSequenceLinkMessage = styled.span`
    color: ${props => props.theme.color.green};
    margin-left: auto;
`;

const StyledAddSequenceLink = styled(Link)`
    margin-left: auto;
`;

export const AddSequenceLink = ({ canModify, dataType, hasUnreferencedTargets }) => {
    if (canModify) {
        if (dataType === "barcode" && !hasUnreferencedTargets) {
            return (
                <AddSequenceLinkMessage>
                    <Icon name="check-double" /> All targets defined
                </AddSequenceLinkMessage>
            );
        }

        return <StyledAddSequenceLink to={{ state: { addSequence: true } }}>Add Sequence</StyledAddSequenceLink>;
    }

    return null;
};

export const mapStateToProps = state => {
    const dataType = getDataType(state);
    return {
        canModify: getCanModifyReferenceOTU(state),
        dataType,
        hasUnreferencedTargets: dataType === "barcode" && getUnreferencedTargets(state).length > 0
    };
};

export default connect(mapStateToProps)(AddSequenceLink);
