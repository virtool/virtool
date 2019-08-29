import { filter, forIn, map, sortBy, split } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Icon, Panel } from "../../../base/index";
import { getResults } from "../../selectors";
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

    render() {
        if (this.props.results.length) {
            let data = filter(this.props.results, otu =>
                this.props.filterOTUs ? otu.reads >= (otu.length * 0.8) / this.props.maxReadLength : true
            );

            data = sortBy(data, this.props.sortKey);

            if (this.props.sortDescending) {
                data.reverse();
            }

            const itemComponents = map(data, item => <PathoscopeItem key={item.id} id={item.id} />);

            return <div>{itemComponents}</div>;
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
    const { filterOTUs, sortDescending, sortKey } = state.analyses;

    return {
        results: getResults(state),
        filterOTUs,
        maxReadLength: state.samples.detail.quality.length[1],
        sortDescending,
        sortKey
    };
};

export default connect(mapStateToProps)(PathoscopeList);
