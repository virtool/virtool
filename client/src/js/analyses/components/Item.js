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
    color: ${props => props.theme.color.greyDarkest};

    &:hover {
        ${props => (props.ready ? "background-color: lightgrey;" : "")};
    }
`;

const AnalysisItemTag = styled.span`
    align-items: center;
    display: inline-flex;
    margin-right: 15px;

    ${SlashList} {
        margin: 0;
    }

    i {
        margin-right: 5px;
    }
`;

const AnalysisItemTags = styled.div`
    align-items: center;
    display: flex;
    margin-top: 10px;
`;

const AnalysisItemTop = styled.div`
    align-items: center;
    display: flex;
    font-size: ${getFontSize("lg")};
    font-weight: ${getFontWeight("thick")};
    justify-content: space-between;

    a {
        font-weight: ${getFontWeight("thick")};
    }
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
        subtractions,
        user,
        workflow,
        onRemove
    } = props;

    const subtractionComponents = subtractions.map(subtraction => (
        <AnalysisItemTag key={subtraction.id}>
            <Icon name="not-equal" />
            <Link to={`/subtraction/${subtraction.id}`}>{subtraction.name}</Link>
        </AnalysisItemTag>
    ));

    return (
        <StyledAnalysisItem>
            <AnalysisItemTop>
                <Link to={`/samples/${sampleId}/analyses/${id}`}>{getTaskDisplayName(workflow)}</Link>
                <AnalysisItemRightIcon canModify={canModify} onRemove={onRemove} ready={ready} />
            </AnalysisItemTop>
            <Attribution user={user.id} time={created_at} />
            <AnalysisItemTags>
                <AnalysisItemTag key="reference">
                    <Icon name="equals" />
                    <SlashList>
                        <li>
                            <Link to={`/refs/${reference.id}`}>{reference.name}</Link>
                        </li>
                        <li>
                            <Link to={`/refs/${reference.id}/indexes/${index.id}`}>Index {index.version}</Link>
                        </li>
                    </SlashList>
                </AnalysisItemTag>
                {subtractionComponents}
            </AnalysisItemTags>
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
