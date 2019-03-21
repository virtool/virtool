import { filter, flatten, forIn, map, sortBy, split } from "lodash-es";
import React from "react";
import { Panel } from "react-bootstrap";
import FlipMove from "react-flip-move";
import { connect } from "react-redux";
import { Icon } from "../../../base/index";
import PathoscopeIsolate from "./Isolate";
import PathoscopeItem from "./Item";

export class PathoscopeList extends React.Component {
    constructor(props) {
        super(props);
        this.itemRefs = {};
    }

    setScroll = (otuId, scrollLeft) => {
        forIn(this.itemRefs, (ref, key) => {
            if (split(key, "-")[0] === otuId) {
                ref.scrollTo(scrollLeft);
            }
        });
    };

    handlePosition = node => {
        const { left, top, right, bottom, height, width } = node.getBoundingClientRect();
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

    render() {
        if (this.props.data.length) {
            let data = filter(this.props.data, otu =>
                this.props.filterOTUs ? otu.reads >= (otu.length * 0.8) / this.props.maxReadLength : true
            );

            if (this.props.filterIsolates) {
                data = map(data, otu => ({
                    ...otu,
                    isolates: filter(otu.isolates, isolate => isolate.pi >= 0.03 * otu.pi)
                }));
            }

            data = sortBy(data, this.props.sortKey);

            if (this.props.sortDescending) {
                data.reverse();
            }

            const rows = map(data, (item, index) => {
                const components = [<PathoscopeItem key={item.id} {...item} />];

                if (item.expanded) {
                    const isolateComponents = map(sortBy(item.isolates, "pi").reverse(), isolate => {
                        const key = `${item.id}-${isolate.id}`;

                        return (
                            <PathoscopeIsolate
                                ref={node => (this.itemRefs[key] = node)}
                                key={key}
                                otuId={item.id}
                                maxDepth={item.maxDepth}
                                maxGenomeLength={item.maxGenomeLength}
                                {...isolate}
                                setScroll={this.setScroll}
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

const mapStateToProps = state => {
    const { data, filterOTUs, filterIsolates, showMedian, sortDescending, sortKey } = state.analyses;

    return {
        data,
        filterIsolates,
        filterOTUs,
        maxReadLength: state.samples.detail.quality.length[1],
        showMedian,
        sortDescending,
        sortKey
    };
};

export default connect(mapStateToProps)(PathoscopeList);
