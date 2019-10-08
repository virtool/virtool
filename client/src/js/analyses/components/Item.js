import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Attribution, Icon, LinkBoxTop, SlashList, SpacedBox } from "../../base";
import { getCanModify } from "../../samples/selectors";

import { getTaskDisplayName } from "../../utils/utils";
import { removeAnalysis } from "../actions";
import { AnalysisItemRightIcon } from "./RightIcon";

const StyledAnalysisItem = styled(SpacedBox)`
    color: #555555;

    &:hover {
        ${props => (props.ready ? "background-color: lightgrey;" : "")};
    }
`;

const AnalysisItemContent = styled.div`
    align-items: center;
    display: flex;
    margin-top: 10px;

    ${SlashList} {
        margin: 0;
    }

    i {
        margin-right: 5px;

        &:last-of-type {
            margin-left: 20px;
        }
    }
`;

export const AnalysisItem = props => {
    const {
        algorithm,
        canModify,
        created_at,
        id,
        index,
        ready,
        reference,
        sampleId,
        subtraction,
        user,
        onRemove
    } = props;

    return (
        <StyledAnalysisItem>
            <LinkBoxTop>
                <Link to={`/samples/${sampleId}/analyses/${id}`}>
                    <strong>{getTaskDisplayName(algorithm)}</strong>
                </Link>
                <AnalysisItemRightIcon canModify={canModify} onRemove={onRemove} ready={ready} />
            </LinkBoxTop>
            <Attribution user={user.id} time={created_at} />
            <AnalysisItemContent>
                <Icon name="equals" />
                <SlashList>
                    <li>
                        <Link to={`/refs/${reference.id}`}>{reference.name}</Link>
                    </li>
                    <li>
                        <Link to={`/refs/${reference.id}/indexes/${index.id}`}>Index {index.version}</Link>
                    </li>
                </SlashList>
                <Icon name="not-equal" />
                <Link to={`/subtraction/${subtraction.id}`}>{subtraction.id}</Link>
            </AnalysisItemContent>
        </StyledAnalysisItem>
    );
};

export const mapStateToProps = state => ({
    sampleId: state.samples.detail.id,
    canModify: getCanModify(state)
});

export const mapDispatchToProps = (dispatch, ownProps) => ({
    onRemove: () => {
        dispatch(removeAnalysis(ownProps.id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(AnalysisItem);
