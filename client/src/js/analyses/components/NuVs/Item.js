import { filter } from "lodash-es";
import numbro from "numbro";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge } from "../../../base";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches } from "../../selectors";
import { AnalysisViewerItem } from "../Viewer/Item";
import { NuVsValues } from "./Values";

const calculateAnnotatedOrfCount = orfs => filter(orfs, orf => orf.hits.length).length;

const NuVsItemHeader = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

const StyledNuVsItem = styled(AnalysisViewerItem)`
    border-bottom: none;
    border-left: none;
    border-radius: 0;
    margin: 0;
`;

export const NuVsItem = ({ active, e, orfs, sequence, sequenceIndex, style, onSetActiveId }) => {
    const handleClick = useCallback(() => onSetActiveId(sequenceIndex), [sequenceIndex]);

    return (
        <StyledNuVsItem active={active} onClick={handleClick} style={style}>
            <NuVsItemHeader>
                <strong>Sequence {sequenceIndex}</strong>
                <Badge>{sequence.length}</Badge>
            </NuVsItemHeader>
            <NuVsValues e={numbro(e).format()} orfCount={calculateAnnotatedOrfCount(orfs)} />
        </StyledNuVsItem>
    );
};

const mapStateToProps = (state, ownProps) => {
    const activeId = getActiveHit(state).index;
    const { e, index, orfs, sequence } = getMatches(state)[ownProps.index];
    return { e, orfs, sequence, sequenceIndex: index, active: activeId === index };
};

const mapDispatchToProps = dispatch => ({
    onSetActiveId: id => {
        dispatch(setActiveHitId(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(NuVsItem);
