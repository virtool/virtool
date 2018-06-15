import React from "react";
import PropTypes from "prop-types";
import FlipMove from "react-flip-move";
import { flatten, forIn, includes, map, sortBy, split } from "lodash-es";
import { Panel } from "react-bootstrap";

import PathoscopeEntry from "./Entry";
import PathoscopeIsolate from "./Isolate";
import { Icon } from "../../../../base";

export default class PathoscopeList extends React.Component {

    constructor (props) {
        super(props);
        this.itemRefs = {};
    }

    static propTypes = {
        expanded: PropTypes.arrayOf(PropTypes.string),
        showReads: PropTypes.bool,
        toggleIn: PropTypes.func,
        data: PropTypes.arrayOf(PropTypes.object).isRequired
    };

    setScroll = (otuId, scrollLeft) => {
        forIn(this.itemRefs, (ref, key) => {
            if (split(key, "-")[0] === otuId) {
                ref.scrollTo(scrollLeft);
            }
        });
    };

    handlePosition = (node) => {
        const {left, top, right, bottom, height, width} = node.getBoundingClientRect();
        const scrollCorrection = window.pageYOffset;

        return {
            left,
            right,
            bottom: bottom + scrollCorrection,
            top: top + scrollCorrection,
            height,
            width
        };
    };

    render () {

        if (this.props.data.length) {
            const rows = map(this.props.data, (item, index) => {

                const expanded = includes(this.props.expanded, item.id);

                const components = [
                    <PathoscopeEntry
                        key={item.id}
                        {...item}
                        toggleIn={this.props.toggleIn}
                        showReads={this.props.showReads}
                        in={expanded}
                    />
                ];

                if (expanded) {

                    const isolateComponents = map(sortBy(item.isolates, "pi").reverse(), isolate => {
                        const key = `${item.id}-${isolate.id}`;

                        return (
                            <PathoscopeIsolate
                                ref={(node) => this.itemRefs[key] = node}
                                key={key}
                                otuId={item.id}
                                maxDepth={item.maxDepth}
                                maxGenomeLength={item.maxGenomeLength}
                                {...isolate}
                                setScroll={this.setScroll}
                                showReads={this.props.showReads}
                            />
                        );
                    });

                    return components.concat(
                        <div key={index} className="list-group-item pathoscope-otu-detail spaced">
                            {isolateComponents}
                        </div>
                    );
                }

                return components;

            });

            return (
                <div>
                    <FlipMove
                        typeName="div"
                        className="list-group"
                        enterAnimation="accordionVertical"
                        leaveAnimation="accordionVertical"
                        getPosition={this.handlePosition}
                    >
                        {flatten(rows)}
                    </FlipMove>
                </div>
            );
        }

        // Show a message if no hits matched the filters.
        return (
            <Panel className="text-center">
                <Panel.Body>
                    <Icon name="info-circle" /> No hits found.
                </Panel.Body>
            </Panel>
        );
    }

}
