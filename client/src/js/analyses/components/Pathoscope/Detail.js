import { filter, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { ScrollSync } from "react-scroll-sync";
import styled from "styled-components";
import { getActiveHit } from "../../selectors";
import { PathoscopeIsolate } from "./Isolate";

const StyledPathoscopeDetail = styled.div``;

export const PathoscopeDetail = ({ filterIsolates, hit, mappedReads, showPathoscopeReads }) => {
    const { isolates, pi } = hit;

    const filtered = filter(isolates, isolate => filterIsolates === false || isolate.pi >= 0.03 * pi);

    const isolateComponents = map(filtered, isolate => {
        return (
            <PathoscopeIsolate
                key={isolate.id}
                {...isolate}
                reads={Math.round(isolate.pi * mappedReads)}
                showPathoscopeReads={showPathoscopeReads}
            />
        );
    });

    return (
        <StyledPathoscopeDetail>
            <ScrollSync>
                <div>{isolateComponents}</div>
            </ScrollSync>
        </StyledPathoscopeDetail>
    );
};

const mapStateToProps = state => ({
    hit: getActiveHit(state),
    filterIsolates: state.analyses.filterIsolates,
    mappedReads: state.analyses.detail.read_count,
    showPathoscopeReads: state.analyses.showPathoscopeReads
});

export default connect(mapStateToProps)(PathoscopeDetail);
