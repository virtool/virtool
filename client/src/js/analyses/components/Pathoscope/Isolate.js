import { map } from "lodash-es";
import React from "react";
import { ScrollSyncPane } from "react-scroll-sync";
import styled from "styled-components";
import { toScientificNotation } from "../../../utils/utils";
import Coverage from "./Coverage";

const PathoscopeChartRibbon = styled.div`
    white-space: nowrap;
    overflow-x: auto;
`;

const PathoscopeIsolateHeader = styled.div`
    align-items: center;
    display: flex;
    padding-bottom: 2px;
    padding-top: 15px;
    margin-bottom: 4px;

    & > strong {
        padding-left: 5px;
    }
`;

const PathoscopeIsolateCoverage = styled.strong`
    color: ${props => props.theme.color.blue};
    font-size: 12px;
    padding-left: 5px;
`;

const PathoscopeIsolateDepth = styled.strong`
    color: ${props => props.theme.color.red};
    font-size: 12px;
    padding-left: 5px;
`;

const StyledPathoscopeIsolateWeight = styled.strong`
    color: ${props => props.theme.color.green};
    font-size: 12px;
`;

export const PathoscopeIsolateWeight = ({ pi, reads, showPathoscopeReads }) => (
    <StyledPathoscopeIsolateWeight>
        {showPathoscopeReads ? reads : toScientificNotation(pi)}
    </StyledPathoscopeIsolateWeight>
);

const StyledPathoscopeIsolate = styled.div`
    position: relative;
`;

export const PathoscopeIsolate = ({ coverage, depth, maxDepth, name, pi, reads, sequences, showPathoscopeReads }) => {
    const hitComponents = map(sequences, (hit, i) => (
        <Coverage
            key={i}
            data={hit.align}
            length={hit.filled.length}
            id={hit.id}
            accession={hit.accession}
            definition={hit.definition}
            yMax={maxDepth}
            showYAxis={i === 0}
        />
    ));

    return (
        <StyledPathoscopeIsolate>
            <PathoscopeIsolateHeader>
                {name}
                <PathoscopeIsolateWeight pi={pi} reads={reads} showPathoscopeReads={showPathoscopeReads} />
                <PathoscopeIsolateDepth>{depth.toFixed(0)}</PathoscopeIsolateDepth>
                <PathoscopeIsolateCoverage>{toScientificNotation(parseFloat(coverage))}</PathoscopeIsolateCoverage>
            </PathoscopeIsolateHeader>
            <ScrollSyncPane>
                <PathoscopeChartRibbon>{hitComponents}</PathoscopeChartRibbon>
            </ScrollSyncPane>
        </StyledPathoscopeIsolate>
    );
};
