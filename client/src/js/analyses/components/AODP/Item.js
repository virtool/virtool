import React, { useCallback } from "react";
import { connect } from "react-redux";

import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches } from "../../selectors";
import { AnalysisViewerItem } from "../Viewer/Item";

export const AODPItem = ({ active, name, id, style, onSetActiveId }) => {
    const handleClick = useCallback(() => onSetActiveId(id), [id]);

    return (
        <AnalysisViewerItem onClick={handleClick} style={style} selected={active}>
            <strong>{name}</strong>
        </AnalysisViewerItem>
    );
};

const mapStateToProps = (state, ownProps) => {
    const activeId = getActiveHit(state).id;
    const matches = getMatches(state);
    const match = matches[ownProps.index];

    const { id, name } = match;
    return { id, name, active: activeId === id };
};

const mapDispatchToProps = dispatch => ({
    onSetActiveId: id => {
        dispatch(setActiveHitId(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AODPItem);
