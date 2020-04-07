import { filter } from "lodash-es";
import numbro from "numbro";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, Box } from "../../../base";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches } from "../../selectors";

const calculateAnnotatedOrfCount = orfs => filter(orfs, orf => orf.hits.length).length;

const NuVsORFCount = styled.span`
    color: ${props => props.theme.color.green};
`;

const NuVsEValue = styled.span`
    color: ${props => props.theme.color.red};
`;

const NuVsItemNumbers = styled.div`
    font-size: ${props => props.theme.fontSize.xs};
    font-weight: bold;
    padding-top: 3px;
`;

const NuVsItemHeader = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

const StyledNuVsItem = styled(Box)`
    border-bottom: none;
    border-left: none;
    border-radius: 0;
    margin: 0;
    ${props => (props.selected ? `box-shadow: inset 3px 0 0 ${props.theme.color.primary};` : "")}
`;

export const NuVsItem = ({ active, e, orfs, sequence, sequenceIndex, style, onSetActiveId }) => {
    const handleClick = useCallback(() => onSetActiveId(sequenceIndex), [sequenceIndex]);

    return (
        <StyledNuVsItem onClick={handleClick} style={style} selected={active}>
            <NuVsItemHeader>
                <strong>Sequence {sequenceIndex}</strong>
                <Badge>{sequence.length}</Badge>
            </NuVsItemHeader>
            <NuVsItemNumbers>
                <NuVsORFCount>{calculateAnnotatedOrfCount(orfs)} ORFs</NuVsORFCount> /{" "}
                <NuVsEValue>E = {numbro(e).format()}</NuVsEValue>
            </NuVsItemNumbers>
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
