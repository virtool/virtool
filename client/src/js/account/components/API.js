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
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Col, ListGroup, ListGroupItem, Modal, Panel, Row } from "react-bootstrap";

import { createAPIKey } from "../actions";
import { Button, Icon, Input } from "../../base";

const getInitialState = (props) => {
    return {
        name: "",
        permissions: {},
        submitted: false,
        key: ""
    };
};

class CreateAPIKey extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        permissions: PropTypes.object,
        onHide: PropTypes.func,
        onCreate: PropTypes.func
    };

    modalExited = () => {
        this.setState(getInitialState());
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.setState({submitted: true}, () => {
            this.props.onCreate(this.state.name, this.state.permissions, (key) => this.setState({key: key}));
        });
    };

    render () {
        let content;

        if (this.state.key) {
            content = (
                <Modal.Body>
                    <Input label="This is your key. It will not be shown again." value={this.state.key} readOnly />
                </Modal.Body>
            );
        } else {
            content = (
                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <Input
                            label="Name"
                            value={this.state.name}
                            onChange={(e) => this.setState({name: e.target.value})}
                        />
                    </Modal.Body>

                    <Modal.Footer>
                        <Button type="submit" icon="floppy" bsStyle="primary">
                            Save
                        </Button>
                    </Modal.Footer>
                </form>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Create API Key
                </Modal.Header>

                {content}
            </Modal>
        );
    }
}

const APIKeys = (props) => {

    let keyComponents = props.apiKeys.map(key => {
        return (
            <ListGroupItem key={key.id}>
                {key.id}
            </ListGroupItem>
        );
    });

    if (!keyComponents.length) {
        keyComponents = (
            <ListGroupItem className="text-center">
                <Icon name="info" /> No API keys found.
            </ListGroupItem>
        );
    }

    return (
        <div>
            <Panel>
                <Row>
                    <Col xs={12} md={10}>
                        <p>
                            Create keys for accessing the Virtool API.
                        </p>
                        <ul>
                            <li>
                                <a href="https://docs.virtool.ca/web-api.html" target="_blank">
                                    learn more about the Virtool API
                                </a>
                            </li>
                            <li>
                                <a href="https://docs.virtool.ca/web-api.html" target="_blank">
                                    learn more about authentication
                                </a>
                            </li>
                        </ul>
                    </Col>
                    <Col xs={12} md={2}>
                        <LinkContainer to={{state: {createAPIKey: true}}}>
                            <Button bsStyle="primary" icon="key" pullRight>
                                Create
                            </Button>
                        </LinkContainer>
                    </Col>
                </Row>
            </Panel>

            <ListGroup>
                {keyComponents}
            </ListGroup>

            <CreateAPIKey
                show={props.location.state && props.location.state.createAPIKey}
                onHide={() => props.history.push({state: {createAPIKey: false}})}
                onCreate={props.onCreate}
            />
        </div>
    );
};

const mapStateToProps = (state) => {
    return {
        apiKeys: state.account.api || []
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onCreate: (name, permissions, callback) => {
            dispatch(createAPIKey(name, permissions, callback));
        },

        onUpdate: (keyId, permissions) => {
            dispatch()
        },

        onRemove: (keyId) => {
            dispatch()
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(APIKeys);

export default Container;
