import { findIndex } from "lodash-es";
import React, { useCallback, useEffect, useRef } from "react";
import { connect } from "react-redux";
import { FixedSizeList } from "react-window";
import styled from "styled-components";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches, getResults } from "../../selectors";
import { Key } from "../../../base/Key";
import NuVsItem from "./Item";

const NuVsListHeader = styled.div`
    background-color: #f5f5f5;
    border: 1px solid ${props => props.theme.color.greyLight};
    border-bottom: none;
    box-shadow: 0 5px 5px -3px #d5d5d5;
    padding: 7px 15px;
    z-index: 1000;
`;

const NuVsListFooter = styled.div`
    font-size: 12px;
    padding: 15px;
    text-align: center;
`;

const StyledNuVsList = styled(FixedSizeList)`
    border: 1px solid ${props => props.theme.color.greyLight};
    flex: 0 0 auto;
`;

export const NuVsList = ({ activeId, nextId, nextIndex, previousId, previousIndex, shown, total, onSetActiveId }) => {
    const windowEl = useRef(null);

    const handleKeyPress = useCallback(
        e => {
            if (e.target !== window.document.body) {
                return;
            }

            if (e.key === "w" && previousIndex > -1) {
                windowEl.current.scrollToItem(previousIndex);
                onSetActiveId(previousId);
            } else if (e.key === "s" && nextIndex > -1) {
                windowEl.current.scrollToItem(nextIndex);
                onSetActiveId(nextId);
            }
        },
        [activeId, nextId, previousId]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyPress, true);
        return () => {
            window.removeEventListener("keydown", handleKeyPress, true);
        };
    });

    return (
        <div>
            <NuVsListHeader>
                Showing {shown} of {total}
            </NuVsListHeader>
            <StyledNuVsList ref={windowEl} height={500} width={230} itemCount={shown} itemSize={58}>
                {NuVsItem}
            </StyledNuVsList>
            <NuVsListFooter>
                Use <Key>w</Key> and <Key>s</Key> to move
            </NuVsListFooter>
        </div>
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
        const activeId = active.index;
        const windowIndex = findIndex(matches, { index: activeId });

        if (windowIndex > 0) {
            previousIndex = windowIndex - 1;
            previousId = matches[previousIndex].index;
        }

        if (windowIndex < matches.length - 1) {
            nextIndex = windowIndex + 1;
            nextId = matches[nextIndex].index;
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

export default connect(mapStateToProps, mapDispatchToProps)(NuVsList);
