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
import { groupBy, map, reverse, sortBy } from "lodash-es";
import { connect } from "react-redux";
import { Row, Col, ListGroup, Label } from "react-bootstrap";

import { getVirusHistory, revert } from "../../actions";
import { Flex, FlexItem, ListGroupItem, RelativeTime, Icon } from "../../../base";


const getMethodIcon = (change) => {

    switch (change.method_name) {
        case "create":
            return <Icon name="new-entry" bsStyle="primary" />;

        case "edit":
            return <Icon name="pencil" bsStyle="warning" />;

        case "verify":
            return <Icon name="checkmark" bsStyle="success" />;

        case "remove":
            return <Icon name="remove" bsStyle="danger" />;

        case "add_isolate":
            return <Icon name="lab" bsStyle="primary" />;

        case "edit_isolate":
            return <Icon name="lab" bsStyle="warning" />;

        case "set_as_default":
            return <Icon name="star" bsStyle="warning" />;

        case "remove_isolate":
            return <Icon name="lab" bsStyle="danger" />;

        case "create_sequence":
            return <Icon name="dna" bsStyle="primary" />;

        case "edit_sequence":
            return <Icon name="dna" bsStyle="warning" />;

        case "remove_sequence":
            return <Icon name="dna" bsStyle="danger" />;

        default:
            return <Icon name="warning" bsStyle="danger" />;
    }
};

export class Change extends React.Component {

    handleRevert = () => {
        this.props.revert(this.props.virus.id, this.props.virus.version);
    };

    render () {
        let revertIcon;

        if (this.props.unbuilt && this.props.canModify) {
            revertIcon = (
                <Icon
                    name="undo"
                    bsStyle="primary"
                    tip="Revert"
                    onClick={this.handleRevert}
                    pullRight
                />
            );
        }

        return (
            <ListGroupItem>
                <Row>
                    <Col md={1}>
                        <Label>{this.props.virus.version}</Label>
                    </Col>
                    <Col md={6}>
                        <Flex alignItems="center">
                            {getMethodIcon(this.props)}
                            <FlexItem pad={5}>
                                {this.props.description || "No Description"}
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={4}>
                        <RelativeTime time={this.props.created_at} /> by {this.props.user.id}
                    </Col>
                    <Col md={1}>
                        {revertIcon}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}

export class HistoryList extends React.Component {

    render () {

        const changes = reverse(sortBy(this.props.history, "virus.version"));

        const changeComponents = map(changes, (change, index) =>
            <Change
                key={index}
                {...change}
                canModify={this.props.canModify}
                unbuilt={this.props.unbuilt}
                revert={this.props.revert}
            />
        );

        return (
            <ListGroup>
                {changeComponents}
            </ListGroup>
        );
    }
}

HistoryList.propTypes = {
    history: PropTypes.arrayOf(PropTypes.object),
    unbuilt: PropTypes.bool,
    revert: PropTypes.func,
    canModify: PropTypes.bool
};

class VirusHistory extends React.Component {

    componentDidMount () {
        this.props.getHistory(this.props.virusId);
    }

    render () {
        if (this.props.history === null) {
            return <div />;
        }

        const changes = groupBy(this.props.history, change => change.index.version === "unbuilt" ? "unbuilt" : "built");

        let built;
        let unbuilt;

        if (changes.built) {
            built = (
                <div>
                    <h4>Built Changes</h4>
                    <HistoryList
                        history={changes.built}
                        canModify={this.props.canModify}
                    />
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
    virusId: state.viruses.detail.id,
    history: state.viruses.detailHistory,
    canModify: state.account.permissions.modify_virus
});

const mapDispatchToProps = dispatch => ({

    getHistory: (virusId) => {
        dispatch(getVirusHistory(virusId));
    },

    revert: (virusId, version) => {
        dispatch(revert(virusId, version));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusHistory);

export default Container;
