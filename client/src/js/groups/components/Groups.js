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
import { filter, find, includes, some, transform } from "lodash";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Col, Label, ListGroup, Modal, Panel, Row } from "react-bootstrap";

import { listGroups, setGroupPermission, removeGroup } from "../actions";
import { AutoProgressBar, Button, Icon, InputSave, ListGroupItem } from "../../base";

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
            showCreate: false
        };
    }

    componentWillMount () {
        this.props.onList();
    }

    componentWillReceiveProps (nextProps) {
        // What to do if the active group was removed OR the active group id in state if onList response is incoming.
        if ((!some(nextProps, {id: this.state.activeId})) || (this.props.groups === null && nextProps.groups)) {
            this.setState({activeId: nextProps.groups[0].id});
        }
    }

    select = (groupId) => {
        this.setState({activeId: groupId});
    };

    render () {

        if (this.props.groups === null) {
            return (
                <div className="text-center" style={{marginTop: "120px"}}>
                    <ClipLoader />
                </div>
            );
        }

        const groupComponents = this.props.groups.map((group) =>
            <ListGroupItem key={group.id}
                active={this.state.activeId === group.id}
                onClick={() => this.select(group.id)}
            >
                <span className="text-capitalize">{group.id}</span>
            </ListGroupItem>
        );

        const activeGroup = find(this.props.groups, {id: this.state.activeId});

        activeGroup.members = filter(this.props.users, user => includes(user.groups, activeGroup.id));

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

        let create;

        if (this.state.showCreate) {
            create = (
                <InputSave
                    onBlur={() => this.setState({showCreate: false})}
                    onSave={(value) => console.log(value)}
                />
            );
        } else {
            create = (
                <Button
                    icon="new-entry"
                    bsStyle="primary"
                    onClick={() => this.setState({showCreate: true})}
                    block
                >
                    Create Group
                </Button>
            )
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Groups
                </Modal.Header>

                <AutoProgressBar active={this.props.pending} affixed />

                <Modal.Body>
                    <Row>
                        <Col md={5}>
                            <ListGroup>
                                {groupComponents}
                            </ListGroup>

                            {create}
                        </Col>
                        <Col md={7}>
                            <Panel header="Permissions">
                                <ListGroup style={{marginBottom: "10px"}} fill>
                                    {permissionComponents}
                                </ListGroup>
                            </Panel>

                            <Panel header="Members">
                                {activeGroup.members.map(member =>
                                    <Label key={member.id} style={{marginRight: "5px"}}>
                                        {member.id}
                                    </Label>
                                )}
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
        pending: state.groups.pending
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onList: () => {
            dispatch(listGroups());
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
