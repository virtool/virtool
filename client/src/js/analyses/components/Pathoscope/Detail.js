import { filter, map, sum } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { ScrollSync } from "react-scroll-sync";
import styled from "styled-components";
import { getActiveHit } from "../../selectors";
import { PathoscopeIsolate } from "./Isolate";

const getContextValue = (isolates, onRendered) => {
    let count = sum(map(isolates, isolate => isolate.sequences.length));

    return {
        count,
        onRendered: () => {
            count--;
            if (count === 0) {
                onRendered();
            }
        }
    };
};

const StyledPathoscopeDetail = styled.div``;

export const PathoscopeDetailContext = React.createContext();

export const PathoscopeDetail = ({ filterIsolates, hit, mappedReads, showPathoscopeReads, onRendered }) => {
    const { isolates, pi } = hit;

    const filtered = filter(isolates, isolate => filterIsolates === false || isolate.pi >= 0.03 * pi);

    const contextValue = getContextValue(filtered, onRendered);

    const isolateComponents = map(filtered, isolate => (
        <PathoscopeIsolate
            key={isolate.id}
            {...isolate}
            reads={Math.round(isolate.pi * mappedReads)}
            showPathoscopeReads={showPathoscopeReads}
        />
    ));

    return (
        <PathoscopeDetailContext.Provider value={contextValue}>
            <StyledPathoscopeDetail>
                <ScrollSync>
                    <div>{isolateComponents}</div>
                </ScrollSync>
            </StyledPathoscopeDetail>
        </PathoscopeDetailContext.Provider>
    );
};

const mapStateToProps = state => ({
    hit: getActiveHit(state),
    filterIsolates: state.analyses.filterIsolates,
    mappedReads: state.analyses.detail.read_count,
    showPathoscopeReads: state.analyses.showPathoscopeReads
});

export default connect(mapStateToProps)(PathoscopeDetail);
