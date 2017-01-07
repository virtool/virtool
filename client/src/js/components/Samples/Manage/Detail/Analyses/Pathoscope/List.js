import React from "react";
import FlipMove from "react-flip-move"
import { forIn, includes, sortBy, flatten } from "lodash";

import PathoscopeEntry from "./Entry";
import PathoscopeIsolate from "./Isolate";

export default class PathoscopeList extends React.Component {

    static propTypes = {
        expanded: React.PropTypes.arrayOf(React.PropTypes.string),
        showReads: React.PropTypes.bool,
        toggleIn: React.PropTypes.func,
        data: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
    };

    setScroll = (virusId, scrollLeft) => {
        forIn(this.refs, (ref, key) => {
            if (key.split("-")[0] === virusId) {
                ref.scrollTo(scrollLeft);
            }
        });
    };

    render () {

        let rows = this.props.data.map((item, index) => {

            const expanded = includes(this.props.expanded, item._id);

            const components = [
                <PathoscopeEntry
                    key={item._id}
                    {...item}
                    toggleIn={this.props.toggleIn}
                    showReads={this.props.showReads}
                    in={expanded}
                />
            ];

            if (expanded) {

                const isolateComponents = sortBy(item.isolates, "pi").reverse().map((isolate) =>
                    <PathoscopeIsolate
                        key={item._id + "-" + isolate.isolate_id}
                        virusId={item._id}
                        maxDepth={item.maxDepth}
                        maxGenomeLength={item.maxGenomeLength}
                        {...isolate}
                        setScroll={this.setScroll}
                        showReads={this.props.showReads}
                    />
                );

                return components.concat(
                    <div key={index} className="list-group-item pathoscope-virus-detail spaced">
                        {isolateComponents}
                    </div>
                );
            }

            return components;

        });

        rows = flatten(rows);

        return (
            <div >
                <FlipMove
                    typeName="div"
                    className="list-group"
                    enterAnimation="accordionVertical"
                    leaveAnimation={false}
                >
                    {rows}
                </FlipMove>
            </div>
        );
    }

}
