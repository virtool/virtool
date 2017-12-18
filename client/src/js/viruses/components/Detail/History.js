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
import { sortBy, groupBy } from "lodash";
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

const HistoryList = (props) => {

    const changeComponents = sortBy(props.history, "virus.version").reverse().map((change, index) => {

        let revertIcon;

        if (props.unbuilt && props.canModify) {
            revertIcon = (
                <Icon
                    name="undo"
                    bsStyle="primary"
                    tip="Revert"
                    onClick={() => props.revert(change.virus.id, change.virus.version)}
                    pullRight
                />
            );
        }

        return (
            <ListGroupItem key={index}>
                <Row>
                    <Col md={1}>
                        <Label>{change.virus.version}</Label>
                    </Col>
                    <Col md={6}>
                        <Flex alignItems="center">
                            {getMethodIcon(change)}
                            <FlexItem pad={5}>
                                {change.description || "No Description"}
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={4}>
                        <RelativeTime time={change.created_at} /> by {change.user.id}
                    </Col>
                    <Col md={1}>
                        {revertIcon}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    });

    return (
        <ListGroup>
            {changeComponents}
        </ListGroup>
    );
};

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
