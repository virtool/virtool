/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React, { PropTypes } from "react";
import { sortBy, groupBy, startsWith } from "lodash";
import { connect } from "react-redux";
import { Row, Col, ListGroup, Label } from "react-bootstrap";

import { getVirusHistory } from "../../actions";
import { ListGroupItem, RelativeTime, Icon } from "virtool/js/components/Base";

export const formatChangeDescription = (change) => {

    const description = change.description;

    if (!description) {
        return (
            <span className="change-description">
                <Icon name="warning" bsStyle="warning" />
                <span>No Description</span>
            </span>
        );
    }

    switch (change.method_name) {

        case "add_isolate":
            return (
                <span className="change-description">
                    <Icon name="new-entry" bsStyle="primary" />
                    <span>
                        {description[0]} <em>{description[1]} ({description[2]})</em>
                    </span>
                </span>
            );

        case "edit_isolate":
            if (startsWith(change.description, "Rename")) {
                return (
                    <span className="change-description">
                        <Icon name="pencil" bsStyle="warning" />
                        <span>
                            {description[0]} <em>{description[1]}</em> to <em>{description[3]} ({description[4]})</em>
                        </span>
                    </span>
                );
            }

            break;

        case "remove_isolate":
            return (
                <span className="change-description">
                    <Icon name="remove" bsStyle="danger" />
                    <span>
                        {description[0]} <em>{description[1]} ({description[2]})</em>
                    </span>
                </span>
            );
    }

    return (
        <span className="change-description">
            <Icon name="warning" bsStyle="info" />
            <span>{change.description.join(" ")}</span>
        </span>
    );
};

const HistoryList = (props) => {

    const changeComponents = sortBy(props.history, "virus_version").reverse().map((change, index) => {

        let revertIcon;

        if (props.unbuilt) {
            revertIcon = (
                <Icon
                    name="undo"
                    bsStyle="primary"
                    tip="Revert"
                    onClick={() => console.log("REVERT")}
                    pullRight
                />
            );
        }

        return (
            <ListGroupItem key={index}>
                <Row>
                    <Col md={1}>
                        <Label>{change.virus_version}</Label>
                    </Col>
                    <Col md={6}>
                        {formatChangeDescription(change)}
                    </Col>
                    <Col md={4}>
                        <RelativeTime time={change.timestamp} />
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
    history: PropTypes.arrayOf(React.PropTypes.object),
    unbuilt: PropTypes.bool
};

class VirusHistory extends React.Component {

    static propTypes = {
        virusId: PropTypes.string,
        history: PropTypes.arrayOf(PropTypes.object),
        getHistory: PropTypes.func
    };

    componentDidMount () {
        this.props.getHistory(this.props.virusId)
    }

    render () {
        if (this.props.history === null) {
            return <div />;
        }

        const changes = groupBy(this.props.history, change => {
            return change.index_version === "unbuilt" ? "unbuilt": "built";
        });

        let built;
        let unbuilt;

        if (changes.built) {
            built = (
                <div>
                    <h4>Built Changes</h4>
                    <HistoryList history={changes.built} />
                </div>
            );
        }

        if (changes.unbuilt) {
            unbuilt = (
                <div>
                    <h4>Unbuilt Changes</h4>
                    <HistoryList history={changes.unbuilt} unbuilt />
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

const mapStateToProps = (state) => {
    return {
        virusId: state.viruses.detail.virus_id,
        history: state.viruses.detailHistory
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getHistory: (virusId) => {
            dispatch(getVirusHistory(virusId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusHistory);

export default Container;
