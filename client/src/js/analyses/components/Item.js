import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Attribution, Icon, SlashList, SpacedBox } from "../../base";
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

const AnalysisItemTop = styled.div`
    align-items: center;
    display: flex;
    font-size: ${getFontSize("lg")};
    font-weight: ${getFontWeight("thick")};
    justify-content: space-between;
`;

export const AnalysisItem = props => {
    const {
        canModify,
        created_at,
        id,
        index,
        ready,
        reference,
        sampleId,
        subtraction,
        user,
        workflow,
        onRemove
    } = props;

    return (
        <StyledAnalysisItem>
            <AnalysisItemTop>
                <Link to={`/samples/${sampleId}/analyses/${id}`}>
                    <strong>{getTaskDisplayName(workflow)}</strong>
                </Link>
                <AnalysisItemRightIcon canModify={canModify} onRemove={onRemove} ready={ready} />
            </AnalysisItemTop>
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
                <Link to={`/subtraction/${subtraction.id}`}>{subtraction.name}</Link>
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

export default connect(mapStateToProps, mapDispatchToProps)(AnalysisItem);
