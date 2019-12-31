import { includes } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { SpacedBox } from "../../../base/index";
import { toScientificNotation } from "../../../utils/utils";
import { toggleResultExpanded } from "../../actions";
import { getPathoscopeItem } from "../../selectors";
import AnalysisValue from "../Value";
import PathoscopeExpansion from "./Expansion";
import OTUCoverage from "./OTUCoverage";

const PathoscopeItemHeader = styled.div`
    display: flex;
    justify-content: space-between;
`;

const PathoscopeItemHeaderAbbreviation = styled.div`
    color: #777777;
    font-size: 12px;
    font-weight: bold;
`;

const PathoscopeItemHeaderValues = styled.div`
    display: flex;
    & > *:not(:first-child) {
        padding-left: 5px;
    }
`;

export const PathoscopeItem = props => {
    const { abbreviation, coverage, depth, filled, name } = props;

    const piValue = props.showReads ? Math.round(props.reads) : toScientificNotation(props.pi);

    const onExpand = useCallback(() => props.onExpand(props.id), [props.id]);

    let expansion;

    if (props.expanded) {
        expansion = <PathoscopeExpansion isolates={props.isolates} otuPi={props.pi} />;
    }

    return (
        <SpacedBox onClick={onExpand}>
            <PathoscopeItemHeader>
                <div>
                    <strong>{name}</strong>
                    <PathoscopeItemHeaderAbbreviation>{abbreviation}</PathoscopeItemHeaderAbbreviation>
                </div>
                <PathoscopeItemHeaderValues>
                    <AnalysisValue color="green" label="Weight" value={piValue} />
                    <AnalysisValue color="red" label="Median Depth" value={depth.toFixed(0)} />
                    <AnalysisValue color="blue" label="Coverage" value={coverage.toFixed(3)} />
                </PathoscopeItemHeaderValues>
            </PathoscopeItemHeader>
            <OTUCoverage id={props.id} filled={filled} />
            {expansion}
        </SpacedBox>
    );
};

const mapStateToProps = (state, ownProps) => {
    const result = getPathoscopeItem(state, ownProps.id);
    return {
        ...result,
        expanded: includes(state.analyses.expanded, result.id),
        showReads: state.analyses.showReads
    };
};

const mapDispatchToProps = dispatch => ({
    onExpand: id => {
        dispatch(toggleResultExpanded(id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PathoscopeItem);
