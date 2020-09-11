import React, { useCallback } from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { Badge } from "../../../base";

import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches } from "../../selectors";
import { AnalysisViewerItem } from "../Viewer/Item";

const StyledAODPItem = styled(AnalysisViewerItem)`
    display: flex;
    justify-content: space-between;
`;

export const AODPItem = ({ active, hits, id, name, style, onSetActiveId }) => {
    const handleClick = useCallback(() => onSetActiveId(id), [id]);

    return (
        <StyledAODPItem active={active} style={style} onClick={handleClick}>
            <strong>{name}</strong>
            <Badge>{hits}</Badge>
        </StyledAODPItem>
    );
};

const mapStateToProps = (state, ownProps) => {
    const activeId = getActiveHit(state).id;
    const matches = getMatches(state);
    const match = matches[ownProps.index];

    const { id, identities, name } = match;
    return { id, name, hits: identities.length, active: activeId === id };
};

const mapDispatchToProps = dispatch => ({
    onSetActiveId: id => {
        dispatch(setActiveHitId(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AODPItem);
