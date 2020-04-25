import { findIndex, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches, getResults } from "../../selectors";
import { useKeyNavigation } from "../Viewer/hooks";
import PathoscopeItem from "./Item";

export const PathoscopeList = ({ activeId, nextId, nextIndex, previousId, previousIndex, matches, onSetActiveId }) => {
    const ref = useKeyNavigation(activeId, nextId, nextIndex, previousId, previousIndex, false, onSetActiveId);
    const itemComponents = map(matches, (match, index) => <PathoscopeItem key={match.id} index={index} {...match} />);
    return <div ref={ref}>{itemComponents}</div>;
};

export const mapStateToProps = state => {
    const matches = getMatches(state);
    const active = getActiveHit(state);

    let activeId;
    let nextId;
    let nextIndex;
    let previousId;
    let previousIndex;

    if (active) {
        const activeId = active.id;
        const windowIndex = findIndex(matches, { id: activeId });

        if (windowIndex > 0) {
            previousIndex = windowIndex - 1;
            previousId = matches[previousIndex].id;
        }

        if (windowIndex < matches.length - 1) {
            nextIndex = windowIndex + 1;
            nextId = matches[nextIndex].id;
        }
    }

    return {
        shown: matches.length,
        total: getResults(state).length,
        activeId,
        matches,
        nextId,
        nextIndex,
        previousId,
        previousIndex
    };
};

export const mapDispatchToProps = dispatch => ({
    onSetActiveId: index => {
        dispatch(setActiveHitId(index));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeList);
