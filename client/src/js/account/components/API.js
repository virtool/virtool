/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import CX from "classnames";
import React from "react";
import Moment from "moment";
import PropTypes from "prop-types";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { assign, isEqual, map, mapValues, reduce, sortBy  } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ButtonToolbar, Col, ListGroup, Modal, Panel, Row } from "react-bootstrap";

import { createAPIKey, updateAPIKey, removeAPIKey } from "../actions";
import { Button, Icon, Input, Flex, FlexItem, ListGroupItem, RelativeTime } from "../../base";

const getInitialState = (props) => {
    return {
        name: "",
        permissions: mapValues(props.permissions, () => false),
        submitted: false,
        copied: false,
        key: ""
    };
};

const APIPermissions = ({ style, userPermissions, keyPermissions, onChange }) => {

    const permissions = map(keyPermissions, (value, key) => ({name: key, allowed: value}));

    const rowComponents = sortBy(permissions, "name").map(permission => {
        const disabled = !userPermissions[permission.name];

        return (
            <ListGroupItem
                key={permission.name}
                onClick={disabled ? null: () => onChange(permission.name, !permission.allowed)}
                disabled={disabled}
            >
                <code>{permission.name}</code>
                <Icon name={`checkbox-${permission.allowed ? "checked": "unchecked"}`} pullRight />
            </ListGroupItem>
        )
    });

    return (
        <Panel style={style}>
            <ListGroup fill>
                {rowComponents}
            </ListGroup>
        </Panel>
    )
};

APIPermissions.propTypes = {
    userPermissions: PropTypes.object.isRequired,
    keyPermissions: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    style: PropTypes.object
};

class CreateAPIKey extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState(props);
    }

    static propTypes = {
        show: PropTypes.bool.isRequired,
        permissions: PropTypes.object.isRequired,
        onHide: PropTypes.func.isRequired,
        onCreate: PropTypes.func.isRequired
    };

    modalExited = () => {
        this.setState(getInitialState(this.props));
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.setState({submitted: true}, () => {
            this.props.onCreate(this.state.name, this.state.permissions, (key) => this.setState({key: key}));
        });
    };

    handlePermissionChange = (key, value) => {
        let update = {};
        update[key] = value;

        this.setState({permissions: assign({}, this.state.permissions, update)});
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

                    <Row style={{marginTop: "10px", marginBottom: "5px"}}>
                        <Col xs={12} md={8} mdOffset={2}>
                            <Flex alignItems="stretch" alignContent="stretch">
                                <FlexItem grow={1}>
                                    <Input
                                        style={{marginBottom: 0}}
                                        formGroupStyle={{marginBottom: 0}}
                                        className="text-center"
                                        value={this.state.key} onChange={() => {}}
                                    />
                                </FlexItem>
                                <CopyToClipboard
                                    text={this.state.key}
                                    onCopy={() => this.setState({copied: true})}
                                >
                                    <Button icon="paste" bsStyle="primary" />
                                </CopyToClipboard>
                            </Flex>
                        </Col>
                    </Row>

                    <small className={CX("text-primary", {"invisible": !this.state.copied})}>
                        <Icon name="checkmark" /> Copied
                    </small>
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

                        <label>Permissions</label>

                        <APIPermissions
                            userPermissions={this.props.permissions}
                            keyPermissions={this.state.permissions}
                            onChange={this.handlePermissionChange}
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

    handlePermissionChange = (key, value) => {
        let update = {};
        update[key] = value;

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
            lower = (
                <div>
                    <Row>
                        <Col xs={12}>
                            <APIPermissions
                                style={{marginTop: "15px"}}
                                userPermissions={this.props.permissions}
                                keyPermissions={this.state.permissions}
                                onChange={this.handlePermissionChange}
                            />
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
                                <Button
                                    bsStyle="primary"
                                    icon="floppy"
                                    onClick={() => this.props.onUpdate(this.props.apiKey.id, this.state.permissions)}
                                    disabled={!this.state.changed}
                                >
                                    Update
                                </Button>
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

        const permissionCount = reduce(this.props.apiKey.permissions, (result, value) => result + (value ? 1: 0), 0);

        return (
            <ListGroupItem key={this.props.apiKey.id} className="spaced" onClick={this.state.in ? null: this.toggleIn}>
                <Row>
                    <Col xs={4}>
                        <strong>{this.props.apiKey.name}</strong>
                    </Col>

                    <Col xs={4}>
                        <span>{permissionCount} perm</span>
                        <span className="hidden-xs hidden-sm">ission</span>{permissionCount === 1 ? null: "s"}
                    </Col>

                    <Col xsHidden smHidden md={3}>
                        Created <RelativeTime time={this.props.apiKey.created_at} />
                    </Col>
                    <Col mdHidden lgHidden xs={3}>
                        {Moment(this.props.apiKey.created_at).format("YY-MM-DD")}
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
            <Flex alignItems="center" style={{marginTop: "-7px", marginBottom: "10px"}}>
                <FlexItem>
                    <div style={{whiteSpace: "wrap"}}>
                        <span>Manage API keys for accessing the </span>
                        <a href="https://docs.virtool.ca/web-api/authentication.html" target="_blank">Virtool API</a>.
                    </div>
                </FlexItem>
                <FlexItem grow={1} shrink={0} pad={7}>
                    <LinkContainer to={{state: {createAPIKey: true}}} className="pull-right">
                        <Button bsStyle="primary" icon="key" pullRight>
                            Create
                        </Button>
                    </LinkContainer>
                </FlexItem>
            </Flex>

            <ListGroup>
                {keyComponents}
            </ListGroup>

            <CreateAPIKey
                show={props.location.state && props.location.state.createAPIKey}
                permissions={props.permissions}
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
            dispatch(updateAPIKey(keyId, permissions));
        },

        onRemove: (keyId) => {
            dispatch(removeAPIKey(keyId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(APIKeys);

export default Container;
