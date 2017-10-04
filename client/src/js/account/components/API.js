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
import { assign, map, sortBy } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Col, ListGroup, Modal, Panel, Row } from "react-bootstrap";

import { createAPIKey } from "../actions";
import { Button, Icon, Input, ListGroupItem, RelativeTime } from "../../base";
import {Checkbox} from "../../base/Checkbox";

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

class APIKey extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            in: false,
            permissions: props.apiKey.permissions
        };
    }

    static propTypes = {
        apiKey: PropTypes.object,
        permissions: PropTypes.object
    };

    toggleIn = () => {
        let state = {in: !this.state.in};

        if (this.state.in) {
            state.permissions = this.props.apiKey.permissions;
        }

        this.setState(state);
    };

    togglePermission = (name) => {
        let update = {};
        update[name] = !this.state.permissions[name];

        this.setState({
            permissions: assign({}, this.state.permissions, update)
        });
    };

    render () {
        let lower;

        if (this.state.in) {
            const permissions = map(this.state.permissions, (value, key) => ({name: key, allowed: value}));

            const rowComponents = sortBy(permissions, "permission").map(permission =>
                <ListGroupItem
                    key={permission.name}
                    onClick={() => this.togglePermission(permission.name)}
                    disabled={!this.props.permissions[permission.name]}
                >
                    {permission.name}
                    <Checkbox checked={permission.allowed} pullRight />
                </ListGroupItem>
            );

            lower = (
                <Row>
                    <Col xs={12}>
                        <Panel style={{marginTop: "15px"}}>
                            <ListGroup fill>
                                {rowComponents}
                            </ListGroup>
                        </Panel>
                    </Col>
                </Row>
            );
        }


        return (
            <ListGroupItem key={this.props.apiKey.id} className="spaced" onClick={this.state.in ? null: this.toggleIn}>
                <Row>
                    <Col xs={5}>
                        {this.props.apiKey.name}
                    </Col>
                    <Col xs={6}>
                        Created <RelativeTime time={this.props.apiKey.created_at} />
                    </Col>
                    <Col xs={1}>
                        <Icon name="remove" bsStyle="danger" pullRight />
                    </Col>
                </Row>

                {lower}
            </ListGroupItem>
        );
    }
}

const APIKeys = (props) => {

    let keyComponents = props.apiKeys.map(apiKey =>
        <APIKey key={apiKey.id} apiKey={apiKey} permissions={props.permissions} />
    );

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
        apiKeys: state.account.api_keys || [],
        permissions: state.account.permissions
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
