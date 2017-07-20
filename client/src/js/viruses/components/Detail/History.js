/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React, { PropTypes } from "react";
import { sortBy, groupBy } from "lodash";
import { connect } from "react-redux";
import { Row, Col, ListGroup, Label } from "react-bootstrap";

import { getVirusHistory } from "../../actions";
import { ListGroupItem, RelativeTime, Icon } from "virtool/js/components/Base";

const HistoryList = (props) => {

    const changeComponents = sortBy(props.history, "virus.version").reverse().map((change, index) => {

        let revertIcon;

        if (props.unbuilt) {
            revertIcon = (
                <Icon
                    name="undo"
                    bsStyle="primary"
                    tip="Revert"
                    onClick={() => window.console.log("REVERT")}
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
                        {change.description}
                    </Col>
                    <Col md={4}>
                        <RelativeTime time={change.created_at} />
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
            return change.index.version === "unbuilt" ? "unbuilt": "built";
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
        virusId: state.viruses.detail.id,
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
