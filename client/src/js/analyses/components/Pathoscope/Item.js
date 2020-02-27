import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { SlashList } from "../../../base";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches } from "../../selectors";
import { AnalysisViewerItem } from "../Viewer/Item";
import { StaticOTUCoverage } from "./OTUCoverage";

const PathoscopeItemTitle = styled.div`
    display: block;
    overflow: hidden;
    font-weight: bold;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const PathoscopeItemSubtitle = styled.small`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

const StyledPathoscopeItem = styled(AnalysisViewerItem)`
    height: 142px;
`;

export const PathoscopeItem = ({ active, hit, style, onSetActiveId }) => {
    const { abbreviation, coverage, depth, id, filled, name, pi } = hit;

    const handleClick = useCallback(() => onSetActiveId(id), [id]);

    return (
        <StyledPathoscopeItem selected={active} style={style} onClick={handleClick}>
            <PathoscopeItemTitle>{name}</PathoscopeItemTitle>
            <PathoscopeItemSubtitle>
                <span>{abbreviation || "No Abbreviation"}</span>
                <SlashList>
                    <li className="text-danger">{depth}</li>
                    <li className="text-success">{pi.toFixed(3)}</li>
                    <li className="text-primary">{coverage.toFixed(3)}</li>
                </SlashList>
            </PathoscopeItemSubtitle>
            <StaticOTUCoverage id={id} filled={filled} />
        </StyledPathoscopeItem>
    );
};

const mapStateToProps = (state, ownProps) => {
    const activeId = getActiveHit(state).id;
    const hit = getMatches(state)[ownProps.index];

    return { hit, active: activeId === hit.id };
};

const mapDispatchToProps = dispatch => ({
    onSetActiveId: id => {
        dispatch(setActiveHitId(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeItem);
