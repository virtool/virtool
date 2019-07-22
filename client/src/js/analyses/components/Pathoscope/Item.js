import React, { useCallback } from "react";
import styled from "styled-components";
import { compact, includes, map, max, maxBy } from "lodash-es";
import { connect } from "react-redux";
import { SpacedBox } from "../../../base/index";
import { toScientificNotation } from "../../../utils/utils";
import { toggleResultExpanded } from "../../actions";
import AnalysisValue from "../Value";
import { median } from "../../utils";
import PathoscopeExpansion from "./Expansion";
import OTUCoverage from "./OTUCoverage";

const calculateIsolateValues = isolates => {
    const merged = mergeCoverage(isolates);
    const coverage = compact(merged).length / merged.length;
    const depth = median(merged);

    return {
        coverage,
        depth,
        merged
    };
};

const mergeCoverage = isolates => {
    const longest = maxBy(isolates, isolate => isolate.filled.length);
    const coverages = map(isolates, isolate => isolate.filled);
    return map(longest.filled, (depth, index) => max(map(coverages, coverage => coverage[index])));
};

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
    const { abbreviation, coverage, depth, merged, name } = props;

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
            <OTUCoverage id={props.id} merged={merged} />
            {expansion}
        </SpacedBox>
    );
};

const mapStateToProps = (state, ownProps) => {
    const result = state.analyses.detail.results[ownProps.index];

    return {
        ...result,
        ...calculateIsolateValues(result.isolates),
        expanded: includes(state.analyses.expanded, result.id),
        showReads: state.analyses.showReads
    };
};

const mapDispatchToProps = dispatch => ({
    onExpand: id => {
        dispatch(toggleResultExpanded(id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PathoscopeItem);
