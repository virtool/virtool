/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";
import PropTypes from "prop-types";
import { get, groupBy, map, reverse, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { ListGroup } from "react-bootstrap";
import { getOTUHistory, revert } from "../../actions";
import { LoadingPlaceholder } from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { Change } from "./Change.js";

export class HistoryList extends React.Component {
    render() {
        const changes = reverse(sortBy(this.props.history, "otu.version"));

        const changeComponents = map(changes, (change, index) => (
            <Change
                key={index}
                {...change}
                canModify={this.props.canModify}
                unbuilt={this.props.unbuilt}
                revert={this.props.revert}
            />
        ));

        return <ListGroup>{changeComponents}</ListGroup>;
    }
}

HistoryList.propTypes = {
    history: PropTypes.arrayOf(PropTypes.object),
    unbuilt: PropTypes.bool,
    revert: PropTypes.func,
    canModify: PropTypes.bool
};

class OTUHistory extends React.Component {
    componentDidMount() {
        this.props.getHistory(this.props.otuId);
    }

    render() {
        if (this.props.history === null) {
            return <LoadingPlaceholder />;
        }

        const changes = groupBy(this.props.history, change =>
            change.index.version === "unbuilt" ? "unbuilt" : "built"
        );

        let built;
        let unbuilt;

        if (changes.built) {
            built = (
                <div>
                    <h4>Built Changes</h4>
                    <HistoryList history={changes.built} canModify={this.props.canModify} />
                </div>
            );
        }

        if (changes.unbuilt) {
            unbuilt = (
                <div>
                    <h4>Unbuilt Changes</h4>
                    <HistoryList
                        history={changes.unbuilt}
                        revert={this.props.revert}
                        canModify={this.props.canModify}
                        unbuilt
                    />
                </div>
            );
        }

        return (
            <div>
                {unbuilt}
                {built}
            </div>
        );
    }
}

const mapStateToProps = state => ({
    otuId: state.otus.detail.id,
    history: state.otus.detailHistory,
    canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu")
});

const mapDispatchToProps = dispatch => ({
    getHistory: otuId => {
        dispatch(getOTUHistory(otuId));
    },

    revert: (otuId, otuVersion, changeId) => {
        dispatch(revert(otuId, otuVersion, changeId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUHistory);
