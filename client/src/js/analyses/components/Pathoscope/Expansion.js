import React from "react";
import { connect } from "react-redux";
import { filter, forEach, map } from "lodash-es";
import PathoscopeIsolate from "./Isolate";

export class PathoscopeExpansion extends React.Component {
    constructor(props) {
        super(props);
        this.hitRefs = {};
    }

    handleScroll = e => {
        forEach(this.hitRefs, ref => {
            ref.current.setScroll(e.target.scrollLeft);
        });
    };

    render() {
        const isolateComponents = map(this.props.isolates, isolate => {
            const ref = React.createRef();
            this.hitRefs[isolate.id] = ref;
            return <PathoscopeIsolate key={isolate.id} ref={ref} {...isolate} onScroll={this.handleScroll} />;
        });

        return <div>{isolateComponents}</div>;
    }
}

export const mapStateToProps = (state, ownProps) => {
    if (state.analyses.filterIsolates) {
        return {
            isolates: filter(ownProps.isolates, isolate => isolate.pi >= 0.03 * ownProps.otuPi)
        };
    }

    return { isolates: ownProps.isolates };
};

export default connect(mapStateToProps)(PathoscopeExpansion);
