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

const StyledPathoscopeIsolate = styled.div`
    position: relative;
`;

export const PathoscopeIsolateWeight = ({ pi, reads, showReads }) => (
    <strong className="small text-success">{showReads ? reads : toScientificNotation(pi)}</strong>
);

export class PathoscopeIsolate extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const props = this.props;

        const { maxDepth, pi, reads, sequences, showReads } = props;

        const hitComponents = map(sequences, (hit, i) => (
            <Coverage
                key={i}
                data={hit.align}
                length={hit.filled.length}
                id={hit.id}
                definition={hit.definition}
                yMax={maxDepth}
                showYAxis={i === 0}
            />
        ));

        return (
            <StyledPathoscopeIsolate>
                <PathoscopeIsolateHeader>
                    {props.name}
                    <PathoscopeIsolateWeight pi={pi} reads={reads} showReads={showReads} />
                    <strong className="small text-danger">{props.depth.toFixed(0)}</strong>
                    <strong className="small text-primary">{toScientificNotation(parseFloat(props.coverage))}</strong>
                </PathoscopeIsolateHeader>
                <ScrollSyncPane>
                    <PathoscopeChartRibbon>{hitComponents}</PathoscopeChartRibbon>
                </ScrollSyncPane>
            </StyledPathoscopeIsolate>
        );
    }
}

export default PathoscopeIsolate;
