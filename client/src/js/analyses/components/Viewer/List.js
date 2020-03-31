import { findIndex } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { FixedSizeList } from "react-window";
import styled from "styled-components";
import { Key } from "../../../base/Key";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches, getResults } from "../../selectors";
import { useKeyNavigation } from "./hooks";

const AnalysisViewerListHeader = styled.div`
    background-color: #f5f5f5;
    border: 1px solid ${props => props.theme.color.greyLight};
    border-bottom: none;
    box-shadow: 0 5px 5px -3px #d5d5d5;
    padding: 7px 15px;
    z-index: 1000;
`;

const AnalysisViewerListFooter = styled.div`
    font-size: 12px;
    padding: 15px;
    text-align: center;
`;

const AnalysisViewerListWindow = styled(FixedSizeList)`
    border: 1px solid ${props => props.theme.color.greyLight};
`;

const StyledAnalysisViewerList = styled.div`
    width: ${props => props.width}px;
`;

export const AnalysisViewerList = ({
    activeId,
    children,
    itemSize,
    nextId,
    nextIndex,
    previousId,
    previousIndex,
    shown,
    total,
    width,
    onSetActiveId
}) => {
    const ref = useKeyNavigation(activeId, nextId, nextIndex, previousId, previousIndex, true, onSetActiveId);

    return (
        <StyledAnalysisViewerList width={width}>
            <AnalysisViewerListHeader>
                Showing {shown} of {total}
            </AnalysisViewerListHeader>
            <AnalysisViewerListWindow ref={ref} height={500} width={width} itemCount={shown} itemSize={itemSize}>
                {children}
            </AnalysisViewerListWindow>
            <AnalysisViewerListFooter>
                Use <Key>w</Key> and <Key>s</Key> to move
            </AnalysisViewerListFooter>
        </StyledAnalysisViewerList>
    );
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

export default connect(mapStateToProps, mapDispatchToProps)(AnalysisViewerList);
