import { filter, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { ScrollSync } from "react-scroll-sync";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, BoxGroupSection } from "../../../base/index";
import { getActiveHit } from "../../selectors";
import AnalysisValue from "../Value";
import PathoscopeIsolate from "./Isolate";
import OTUCoverage from "./OTUCoverage";

const PathoscopeDetailHeader = styled(BoxGroupHeader)`
    display: flex;
    justify-content: space-between;
`;

const PathoscopeItemHeaderValues = styled.div`
    display: flex;
    & > *:not(:first-child) {
        padding-left: 5px;
    }
`;

const StyledPathoscopeDetail = styled(BoxGroup)`
    max-width: 100%;
    min-width: 300px;
`;

export const PathoscopeDetail = ({ filterIsolates, hit }) => {
    const { name, pi, coverage, filled, id, depth, isolates } = hit;

    const filtered = filter(isolates, isolate => filterIsolates === false || isolate.pi >= 0.03 * pi);

    const isolateComponents = map(filtered, isolate => {
        return <PathoscopeIsolate key={isolate.id} {...isolate} />;
    });

    return (
        <StyledPathoscopeDetail>
            <PathoscopeDetailHeader>
                <h2>{name}</h2>
            </PathoscopeDetailHeader>
            <BoxGroupSection>
                <PathoscopeItemHeaderValues>
                    <AnalysisValue color="green" label="Weight" value={pi.toFixed(3)} />
                    <AnalysisValue color="red" label="Median Depth" value={depth.toFixed(0)} />
                    <AnalysisValue color="blue" label="Coverage" value={coverage.toFixed(3)} />
                </PathoscopeItemHeaderValues>
                <OTUCoverage id={id} filled={filled} />
            </BoxGroupSection>
            <BoxGroupSection>
                <ScrollSync>
                    <div>{isolateComponents}</div>
                </ScrollSync>
            </BoxGroupSection>
        </StyledPathoscopeDetail>
    );
};

const mapStateToProps = state => ({
    hit: getActiveHit(state),
    filterIsolates: state.analyses.filterIsolates
});

export default connect(mapStateToProps)(PathoscopeDetail);
