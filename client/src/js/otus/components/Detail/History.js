import { get, groupBy, map, reverse, sortBy } from "lodash-es";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import { Badge, BoxGroup, BoxGroupHeader, LoadingPlaceholder, BoxGroupSection } from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { getOTUHistory, revert } from "../../actions";
import { Change } from "./Change.js";

const HistoryList = ({ canModify, history, revert, unbuilt }) => {
    const changes = reverse(sortBy(history, "otu.version"));

    const changeComponents = map(changes, (change, index) => (
        <Change
            key={index}
            id={change._id}
            methodName={change.method_name}
            otu={change.otu}
            user={change.user}
            description={change.description}
            createdAt={change.created_at}
            canModify={canModify}
            unbuilt={unbuilt}
            onRevert={revert}
        />
    ));

    return <BoxGroupSection>{changeComponents}</BoxGroupSection>;

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>
                    <span>{unbuilt ? "Unb" : "B"}uilt Changes</span>
                    <Badge>{changes.length}</Badge>
                </h2>
            </BoxGroupHeader>
            {changeComponents}
        </BoxGroup>
    );
};

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
            built = <HistoryList history={changes.built} canModify={this.props.canModify} />;
        }

        if (changes.unbuilt) {
            unbuilt = (
                <HistoryList
                    history={changes.unbuilt}
                    revert={this.props.revert}
                    canModify={this.props.canModify}
                    unbuilt
                />
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
