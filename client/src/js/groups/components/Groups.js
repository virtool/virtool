import { push } from "connected-react-router";
import { find, get, includes, map, sortBy } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    BoxGroup,
    Input,
    InputContainer,
    InputError,
    InputGroup,
    InputIcon,
    LoadingPlaceholder,
    Modal,
    ModalBody,
    ModalHeader
} from "../../base";
import { clearError } from "../../errors/actions";
import { routerLocationHasState } from "../../utils/utils";

import { createGroup, removeGroup, setGroupPermission } from "../actions";
import { GroupDetail } from "./Detail";
import Group from "./Group";

const GroupsModalBody = styled(ModalBody)`
    display: grid;
    grid-template-columns: 2fr 3fr;
    grid-column-gap: 15px;
`;

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
            this.props.onClearError();
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
            this.props.onClearError();
        }
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.createGroupId === "") {
            this.setState({
                error: "Name is required"
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

        let error;

        if (this.state.submitted && this.props.error) {
            error = this.props.error;
        }

        if (this.state.spaceError) {
            error = "Group names may not contain spaces";
        }

        return (
            <Modal
                label="Manage Groups"
                show={this.props.show}
                size="lg"
                onHide={this.props.onHide}
                onExited={this.handleModalExited}
            >
                <ModalHeader>Manage Groups</ModalHeader>
                <GroupsModalBody>
                    <div>
                        <form onSubmit={this.handleSubmit}>
                            <InputGroup>
                                <InputContainer align="right">
                                    <Input
                                        value={this.state.createGroupId}
                                        onChange={this.handleChange}
                                        placeholder="New"
                                    />
                                    <InputIcon name="plus-circle" bsStyle="primary" onClick={this.handleSubmit} />
                                </InputContainer>
                                <InputError>{error || this.state.error}</InputError>
                            </InputGroup>
                        </form>
                        <BoxGroup>{groupComponents}</BoxGroup>
                    </div>
                    <GroupDetail
                        group={activeGroup}
                        pending={this.props.pending}
                        users={this.props.users}
                        onRemove={this.props.onRemove}
                        onSetPermission={this.props.onSetPermission}
                    />
                </GroupsModalBody>
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

    onClearError: () => {
        dispatch(clearError("CREATE_GROUP_ERROR"));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Groups);
