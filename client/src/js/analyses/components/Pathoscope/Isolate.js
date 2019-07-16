import React, { useEffect } from "react";
import styled from "styled-components";
import { map } from "lodash-es";
import { toScientificNotation } from "../../../utils/utils";
import Coverage from "./Coverage";

const PathoscopeChartContainer = styled.div`
    border-radius: 2px;
    box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.1);
    margin-top: 5px;
    overflow-x: scroll;
`;

const PathoscopeChartRibbon = styled.div`
    white-space: nowrap;
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

export const PathoscopeIsolateWeight = ({ pi, reads, showReads }) => (
    <strong className="small text-success">{showReads ? reads : toScientificNotation(pi)}</strong>
);

export const PathoscopeIsolate = React.forwardRef((props, ref) => {
    useEffect(() => {
        ref.current.addEventListener("scroll", props.onScroll);
        return () => ref.current.removeEventListener("scroll", props.onScroll);
    });

    const { maxDepth, pi, reads, sequences, showReads } = props;

    const hitComponents = map(sequences, (hit, i) => (
        <Coverage
            key={i}
            data={hit.align}
            length={hit.length}
            id={hit.id}
            definition={hit.definition}
            yMax={maxDepth}
            showYAxis={i === 0}
        />
    ));

    return (
        <div>
            <PathoscopeIsolateHeader>
                {props.name}
                <PathoscopeIsolateWeight pi={pi} reads={reads} showReads={showReads} />
                <strong className="small text-danger">{props.depth.toFixed(0)}</strong>
                <strong className="small text-primary">{toScientificNotation(parseFloat(props.coverage))}</strong>
            </PathoscopeIsolateHeader>
            <PathoscopeChartContainer ref={ref}>
                <PathoscopeChartRibbon>{hitComponents}</PathoscopeChartRibbon>
            </PathoscopeChartContainer>
        </div>
    );
});

export default PathoscopeIsolate;
