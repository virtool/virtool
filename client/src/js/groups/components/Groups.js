/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Groups
 */

import React from "react";
import { difference, filter, find, includes, some, sortBy, transform } from "lodash";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Col, FormControl, Label, ListGroup, Modal, Overlay, Panel, Popover, Row } from "react-bootstrap";

import { listGroups, setGroupPermission, removeGroup } from "../actions";
import { AutoProgressBar, Button, Flex, FlexItem, Icon, ListGroupItem } from "../../base";
import {createGroup} from "../actions";

/**
 * Renders either a table describing the sessions associated with the user or a panel with a message indicating no
 * sessions are associated with that user.
 *
 * @class
 */
class Groups extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            activeId: null,
            createGroupId: "",
            spaceError: false,
            submitted: false
        };
    }

    componentWillMount () {
        if (this.props.groups === null) {
            this.props.onList();
        } else {
            this.setState({
                activeId: this.props.groups[0].id
            });
        }
    }

    componentWillReceiveProps (nextProps) {
        let state = {};

        // What to do if the active group was removed OR the active group id in state if onList response is incoming.
        if (!some(nextProps.groups, {id: this.state.activeId}) || (this.props.groups === null && nextProps.groups)) {
            state.activeId = nextProps.groups[0].id;
        }

        if (this.props.groups !== null && nextProps.groups.length > this.props.groups.length) {
            state.activeId = difference(nextProps.groups, this.props.groups)[0].id;
            state.createGroupId = "";
        }

        this.setState(state);
    }

    modalExited = () => {
        this.setState({
            createGroupId: "",
            spaceError: false,
            submitted: false
        });
    };

    select = (groupId) => {
        this.setState({activeId: groupId});
    };

    handleSubmit = (event) => {
        event.preventDefault();

        if (this.state.createGroupId !== "") {
            if (this.state.createGroupId.includes(" ")) {
                this.setState({
                    spaceError: true
                });
            } else {
                this.setState({submitted: true}, () => this.props.onCreate(this.state.createGroupId));
            }
        }
    };

    render () {

        if (this.props.groups === null || this.props.users === null) {
            return (
                <div className="text-center" style={{marginTop: "120px"}}>
                    <ClipLoader />
                </div>
            );
        }

        const groupComponents = sortBy(this.props.groups, "id").map((group) =>
            <ListGroupItem key={group.id}
                active={this.state.activeId === group.id}
                onClick={() => this.select(group.id)}
            >
                <span className="text-capitalize">{group.id}</span>
            </ListGroupItem>
        );

        const activeGroup = find(this.props.groups, {id: this.state.activeId});

        let memberComponents = filter(this.props.users, user => includes(user.groups, activeGroup.id)).map(member =>
            <Label key={member.id} style={{marginRight: "5px"}}>
                {member.id}
            </Label>
        );

        if (!memberComponents.length) {
            memberComponents = (
                <div className="text-center">
                    <Icon name="info" /> No members found.
                </div>
            )
        }

        let error;

        if (this.state.submitted && this.props.createError) {
            error = "Group with that name already exists";
        }

        // This error text is shown when the group name contains a space.
        if (this.state.spaceError) {
            error = "Group names may not contain spaces";
        }

        const permissionComponents = transform(activeGroup.permissions, (result, value, key) => {
            const readOnly = activeGroup.id === "administrator";

            result.push(
                <ListGroupItem
                    key={key}
                    onClick={readOnly ? null: () => this.props.onSetPermission(activeGroup.id, key, !value)}
                    disabled={readOnly}
                >
                    <code>{key}</code> <Icon name={`checkbox-${value ? "checked": "unchecked"}`} pullRight />
                </ListGroupItem>
            );

            return result;
        }, []);

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.modalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Groups
                </Modal.Header>

                <AutoProgressBar active={this.props.pending} affixed />

                <Modal.Body>
                    <Row>
                        <Col md={5}>
                            <form onSubmit={this.handleSubmit}>
                                <Flex alignItems="stretch" style={{marginBottom: "5px"}}>
                                    <FlexItem grow={1} shrink={1}>
                                        <Overlay
                                            show={!!error}
                                            container={this}
                                            target={() => this.inputNode}
                                            placement="top"
                                        >
                                            <Popover id="create-group-error">
                                                {error}
                                            </Popover>
                                        </Overlay>
                                        <FormControl
                                            type="text"
                                            inputRef={(node) => this.inputNode = node}
                                            value={this.state.createGroupId}
                                            onChange={(e) => this.setState({
                                                createGroupId: e.target.value,
                                                spaceError: this.state.spaceError && e.target.value.includes(" "),
                                                submitted: false
                                            })}
                                        />
                                    </FlexItem>
                                    <FlexItem grow={1} shrink={1}>
                                        <Button
                                            type="submit"
                                            bsStyle="primary"
                                            icon="plus-square"
                                            style={{height: "100%"}}
                                        />
                                    </FlexItem>
                                </Flex>
                            </form>

                            <ListGroup>
                                {groupComponents}
                            </ListGroup>
                        </Col>
                        <Col md={7}>
                            <Panel header="Permissions">
                                <ListGroup style={{marginBottom: "10px"}} fill>
                                    {permissionComponents}
                                </ListGroup>
                            </Panel>

                            <Panel header="Members">
                                {memberComponents}
                            </Panel>

                            <Button
                                icon="remove"
                                bsStyle="danger"
                                disabled={activeGroup.id === "administrator"}
                                onClick={() => this.props.onRemove(activeGroup.id)}
                                block
                            >
                                Remove Group
                            </Button>
                        </Col>
                    </Row>
                </Modal.Body>
            </Modal>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        users: state.users.list,
        groups: state.groups.list,
        pending: state.groups.pending,
        createError: state.groups.createError
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onList: () => {
            dispatch(listGroups());
        },

        onCreate: (groupId) => {
            dispatch(createGroup(groupId));
        },

        onSetPermission: (groupId, permission, value) => {
            dispatch(setGroupPermission(groupId, permission, value));
        },

        onRemove: (groupId) => {
            dispatch(removeGroup(groupId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Groups);

export default Container;
