import { compact, map, max, maxBy } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { Flex, FlexItem, SpacedBox } from "../../../base/index";
import { toScientificNotation } from "../../../utils/utils";
import { toggleExpanded } from "../../actions";
import AnalysisValue from "../Value";
import { median } from "../../utils";
import OTUCoverage from "./OTUCoverage";

const mergeCoverage = isolates => {
    const longest = maxBy(isolates, isolate => isolate.filled.length);

    const coverages = map(isolates, isolate => isolate.filled);

    return map(longest.filled, (depth, index) => max(map(coverages, coverage => coverage[index])));
};

const PathoscopeItemHeader = styled.div`
    flex: 1 0 auto;
`;

const PathoscopeItemHeaderAbbreviation = styled.div`
    color: #777777;
    font-size: 12px;
    font-weight: bold;
`;

export const PathoscopeItem = props => {
    const piValue = props.showReads ? Math.round(props.reads) : toScientificNotation(props.pi);

    const onExpand = useCallback(() => props.onExpand(props.id), [props.id]);

    const merged = mergeCoverage(props.isolates);

    const coverage = compact(merged).length / merged.length;

    const depth = median(merged);

    return (
        <SpacedBox onClick={onExpand}>
            <Flex>
                <PathoscopeItemHeader>
                    <strong>{props.name}</strong>
                    <PathoscopeItemHeaderAbbreviation>{props.abbreviation}</PathoscopeItemHeaderAbbreviation>
                </PathoscopeItemHeader>

                <FlexItem>
                    <AnalysisValue color="green" label="Weight" value={piValue} />
                </FlexItem>

                <FlexItem pad={5}>
                    <AnalysisValue color="red" label="Median Depth" value={depth.toFixed(1)} />
                </FlexItem>
                <FlexItem pad={5}>
                    <AnalysisValue color="blue" label="Coverage" value={coverage.toFixed(3)} />
                </FlexItem>
            </Flex>
            <OTUCoverage merged={merged} />
        </SpacedBox>
    );
};

const mapStateToProps = (state, ownProps) => ({
    ...state.analyses.data[ownProps.index],
    showReads: state.analyses.showReads
});

const mapDispatchToProps = dispatch => ({
    onExpand: id => {
        dispatch(toggleExpanded(id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PathoscopeItem);
