import { push } from "connected-react-router";
import { filter, find, get, includes, map, sortBy, transform } from "lodash-es";
import React from "react";
import { Col, InputGroup, ListGroup, Modal, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { AutoProgressBar, Button, Icon, InputError, Label, ListGroupItem, LoadingPlaceholder, Panel } from "../../base";
import { clearError } from "../../errors/actions";
import { routerLocationHasState } from "../../utils/utils";

import { createGroup, removeGroup, setGroupPermission } from "../actions";
import Group from "./Group";

class Groups extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            createGroupId: "",
            spaceError: false,
            submitted: false,
            error: ""
        };
    }

    handleModalExited = () => {
        this.setState({
            createGroupId: "",
            spaceError: false,
            submitted: false,
            error: ""
        });

        if (this.props.error) {
            this.props.onClearError("CREATE_GROUP_ERROR");
        }
    };

    handleChange = e => {
        this.setState({
            createGroupId: e.target.value,
            spaceError: this.state.spaceError && includes(e.target.value, " "),
            submitted: false,
            error: ""
        });

        if (this.props.error) {
            this.props.onClearError("CREATE_GROUP_ERROR");
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.createGroupId === "") {
            this.setState({
                error: "Group id missing"
            });
        } else if (includes(this.state.createGroupId, " ")) {
            this.setState({
                spaceError: true
            });
        } else {
            this.setState(
                {
                    spaceError: false,
                    submitted: true,
                    error: ""
                },
                () => this.props.onCreate(this.state.createGroupId)
            );
        }
    };

    render() {
        if (this.props.groups === null || this.props.users === null) {
            return <LoadingPlaceholder margin="130px" />;
        }

        const groupComponents = map(sortBy(this.props.groups, "id"), group => <Group key={group.id} {...group} />);

        const activeGroup = find(this.props.groups, { id: this.props.activeId });

        let members;

        if (activeGroup) {
            members = filter(this.props.users, user => includes(user.groups, activeGroup.id));
        }

        let memberComponents;

        if (members && members.length) {
            memberComponents = map(members, member => (
                <Label key={member.id} spaced>
                    {member.id}
                </Label>
            ));
        } else {
            memberComponents = (
                <div className="text-center">
                    <Icon name="info-circle" /> No members found.
                </div>
            );
        }

        let error;

        if (this.state.submitted && this.props.error) {
            error = this.props.error;
        }

        if (this.state.spaceError) {
            error = "Group names may not contain spaces";
        }

        let permissionComponents = [];

        if (activeGroup) {
            permissionComponents = transform(
                activeGroup.permissions,
                (result, value, key) => {
                    result.push(
                        <ListGroupItem
                            key={key}
                            onClick={() => this.props.onSetPermission(activeGroup.id, key, !value)}
                        >
                            <code>{key}</code> <Icon faStyle="far" name={value ? "check-square" : "square"} pullRight />
                        </ListGroupItem>
                    );

                    return result;
                },
                []
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Groups
                </Modal.Header>

                <AutoProgressBar active={this.props.pending} affixed />

                <Modal.Body>
                    <Row>
                        <Col md={5}>
                            <InputGroup>
                                <InputError
                                    type="text"
                                    value={this.state.createGroupId}
                                    onChange={this.handleChange}
                                    error={error || this.state.error}
                                />
                                <InputGroup.Button style={{ verticalAlign: "top", zIndex: "0" }}>
                                    <Button type="button" bsStyle="primary" onClick={this.handleSubmit}>
                                        <Icon
                                            name="plus-square"
                                            style={{ verticalAlign: "middle", marginLeft: "3px" }}
                                        />
                                    </Button>
                                </InputGroup.Button>
                            </InputGroup>
                            <br />
                            <ListGroup>{groupComponents}</ListGroup>
                        </Col>
                        <Col md={7}>
                            <Panel>
                                <Panel.Heading>Permissions</Panel.Heading>
                                <ListGroup>{permissionComponents}</ListGroup>
                            </Panel>

                            <Panel>
                                <Panel.Heading>Members</Panel.Heading>
                                <Panel.Body>{memberComponents}</Panel.Body>
                            </Panel>

                            <Button
                                icon="trash"
                                bsStyle="danger"
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

const mapStateToProps = state => ({
    show: routerLocationHasState(state, "groups"),
    users: state.users.documents,
    groups: state.groups.documents,
    pending: state.groups.pending,
    activeId: state.groups.activeId,
    error: get(state, "errors.CREATE_GROUP_ERROR.message", "")
});

const mapDispatchToProps = dispatch => ({
    onCreate: groupId => {
        dispatch(createGroup(groupId));
    },

    onHide: () => {
        dispatch(push({ ...window.location, state: { groups: false } }));
    },

    onRemove: groupId => {
        dispatch(removeGroup(groupId));
    },

    onSetPermission: (groupId, permission, value) => {
        dispatch(setGroupPermission(groupId, permission, value));
    },

    onClearError: error => {
        dispatch(clearError(error));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Groups);
