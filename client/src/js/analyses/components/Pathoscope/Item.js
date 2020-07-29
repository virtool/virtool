import React, { useCallback, useRef } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getActiveShadow, getColor } from "../../../app/theme";
import { SpacedBox } from "../../../base";
import { toScientificNotation } from "../../../utils/utils";
import { setActiveHitId } from "../../actions";
import { getActiveHit, getMatches } from "../../selectors";
import Detail from "./Detail";
import { OTUCoverage } from "./OTUCoverage";

const PathoscopeItemHeader = styled.h3`
    display: flex;
    font-size: ${props => props.theme.fontSize.md};
    margin: 5px 0 10px;
`;

const StyledPathoscopeItemValue = styled.div`
    display: flex;
    flex-direction: column;
    padding-left: 10px;
    width: 100px;

    span {
        color: ${getColor};
        font-weight: bold;
    }

    small {
        color: ${props => props.theme.color.greyDark};
        font-size: ${props => props.theme.fontSize.sm};
        font-weight: bold;
        padding-top: 5px;
    }
`;

const PathoscopeItemValue = ({ color, label, value }) => (
    <StyledPathoscopeItemValue color={color}>
        <span>{value}</span>
        <small>{label}</small>
    </StyledPathoscopeItemValue>
);

const PathoscopeItemValues = styled.div`
    display: flex;
    margin-left: auto;
`;

const PathoscopeItemTitle = styled.div`
    display: flex;
    flex-direction: column;
    font-weight: bold;

    span:not(:first-child) {
        color: ${props => props.theme.color.greyDark};
        padding-top: 5px;
    }
`;

const StyledPathoscopeItem = styled(SpacedBox)`
    box-shadow: ${getActiveShadow};
`;

export const PathoscopeItem = props => {
    const { active, hit, mappedCount, showPathoscopeReads, style } = props;
    const { abbreviation, coverage, depth, filled, name, pi } = hit;

    const ref = useRef(null);

    const piValue = showPathoscopeReads ? Math.round(pi * mappedCount) : toScientificNotation(pi);

    const handleClick = useCallback(() => {
        props.onSetActiveId(hit.id);
    }, [hit.id]);

    const handleRendered = useCallback(() => {
        if (active) {
            let y;

            if (props.index === 0) {
                // Scroll to the top of the page if the first item is becoming active.
                y = 0;
            } else {
                const top = ref.current.getBoundingClientRect().top;
                const offset = window.scrollY;
                y = top + offset - 50;
            }

            window.scrollTo({ top: y, behavior: "smooth" });
        }
    }, [active]);

    return (
        <StyledPathoscopeItem ref={ref} active={active} style={style} onClick={active ? null : handleClick}>
            <PathoscopeItemHeader>
                <PathoscopeItemTitle>
                    <span>{name}</span>
                    <span>{abbreviation || "No Abbreviation"}</span>
                </PathoscopeItemTitle>
                <PathoscopeItemValues>
                    <PathoscopeItemValue
                        color="green"
                        label={showPathoscopeReads ? "READS" : "WEIGHT"}
                        value={piValue}
                    />
                    <PathoscopeItemValue color="red" label="DEPTH" value={depth} />
                    <PathoscopeItemValue color="blue" label="COVERAGE" value={coverage.toFixed(3)} />
                </PathoscopeItemValues>
            </PathoscopeItemHeader>
            <OTUCoverage filled={filled} />
            {active ? <Detail onRendered={handleRendered} /> : null}
        </StyledPathoscopeItem>
    );
};

const mapStateToProps = (state, ownProps) => {
    const activeId = getActiveHit(state).id;
    const hit = getMatches(state)[ownProps.index];

    return {
        hit,
        active: activeId === hit.id,
        mappedCount: state.analyses.detail.read_count,
        showPathoscopeReads: state.analyses.showPathoscopeReads
    };
};

const mapDispatchToProps = dispatch => ({
    onSetActiveId: id => {
        dispatch(setActiveHitId(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeItem);
