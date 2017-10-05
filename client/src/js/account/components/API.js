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
import { CopyToClipboard } from "react-copy-to-clipboard";
import { assign, map, sortBy, isEqual } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ButtonToolbar, Col, ListGroup, Modal, Panel, Row } from "react-bootstrap";

import { createAPIKey, removeAPIKey } from "../actions";
import { Button, Icon, Input, Flex, FlexItem, ListGroupItem, RelativeTime } from "../../base";

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
                <Modal.Body className="text-center">
                    <Row>
                        <Col xs={12}>
                            <strong className="text-success">Here is your key.</strong>
                        </Col>
                    </Row>

                    <small>
                        Make note of it now. For security purposes, it will not be shown again.
                    </small>

                    <Row style={{marginTop: "10px"}}>
                        <Col xs={12} md={8} mdOffset={2}>
                            <Flex alignItems="stretch" alignContent="stretch">
                                <FlexItem grow={1}>
                                    <Input value={this.state.key} onChange={() => {}} />
                                </FlexItem>
                                <CopyToClipboard
                                    style={{marginBottom: "15px"}}
                                    text={this.state.key}
                                    onCopy={() => {}}
                                >
                                    <Button icon="paste" bsStyle="primary" />
                                </CopyToClipboard>
                            </Flex>
                        </Col>
                    </Row>
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
            changed: false,
            permissions: props.apiKey.permissions
        };
    }

    static propTypes = {
        apiKey: PropTypes.object,
        permissions: PropTypes.object,
        onRemove: PropTypes.func,
        onUpdate: PropTypes.func
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

        const permissions = assign({}, this.state.permissions, update);

        this.setState({
            changed: !isEqual(permissions, this.props.apiKey.permissions),
            permissions: permissions
        });
    };

    render () {
        let lower;
        let closeButton;

        if (this.state.in) {
            const permissions = map(this.state.permissions, (value, key) => ({name: key, allowed: value}));

            const rowComponents = sortBy(permissions, "permission").map(permission => {
                const disabled = !this.props.permissions[permission.name];

                return (
                    <ListGroupItem
                        key={permission.name}
                        onClick={disabled ? null: () => this.togglePermission(permission.name)}
                        disabled={disabled}
                    >
                        <code>{permission.name}</code>
                        <Icon name={`checkbox-${permission.allowed ? "checked": "unchecked"}`} pullRight />
                    </ListGroupItem>
                )
            });

            let updateButton;

            if (this.state.changed) {
                updateButton = (
                    <Button
                        bsStyle="primary"
                        icon="floppy"
                        onClick={() => this.onUpdate(this.apiKey.id, this.state.permissions)}
                    >
                        Update
                    </Button>
                );
            }

            lower = (
                <div>
                    <Row>
                        <Col xs={12}>
                            <Panel style={{marginTop: "15px"}}>
                                <ListGroup fill>
                                    {rowComponents}
                                </ListGroup>
                            </Panel>
                        </Col>
                    </Row>
                    <Row>
                        <Col xs={12}>
                            <ButtonToolbar className="pull-right">
                                <Button
                                    bsStyle="danger"
                                    icon="remove"
                                    onClick={() => this.props.onRemove(this.props.apiKey.id)}
                                >
                                    Remove
                                </Button>
                                {updateButton}
                            </ButtonToolbar>
                        </Col>
                    </Row>
                </div>
            );

            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
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
                        {closeButton}
                    </Col>
                </Row>

                {lower}
            </ListGroupItem>
        );
    }
}

const APIKeys = (props) => {

    let keyComponents = props.apiKeys.map(apiKey =>
        <APIKey
            key={apiKey.id}
            apiKey={apiKey}
            permissions={props.permissions}
            onUpdate={props.onUpdate}
            onRemove={props.onRemove}
        />
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
                                <a href="https://docs.virtool.ca/web-api/authentication.html" target="_blank">
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
            dispatch(removeAPIKey(keyId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(APIKeys);

export default Container;
