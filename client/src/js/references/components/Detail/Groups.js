import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap";
import { map, filter, some } from "lodash-es";

import MemberEntry from "./MemberEntry";
import AddReferenceMember from "./AddMember";
import { Flex, FlexItem, Icon, LoadingPlaceholder } from "../../../base";
import { addReferenceGroup, editReferenceGroup, removeReferenceGroup } from "../../../references/actions";
import { listGroups } from "../../../groups/actions";

const getOtherGroups = (groupList, groups) => {
    const otherGroups = filter(groupList, group => (
        !some(groups, ["id", group.id])
    ));
    return otherGroups;
};

const getInitialState = () => ({
    value: "",
    selectedGroup: "",
    showAdd: false
});

class ReferenceGroups extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    componentDidMount () {
        this.props.onListGroups();
    }

    add = () => {
        this.setState({ showAdd: true });
    };

    edit = (groupId, key, value) => {
        const update = { [key]: value };
        this.props.onEdit(this.props.refId, groupId, update);
    };

    handleRemove = (groupId) => {
        this.props.onRemove(this.props.refId, groupId);
    };

    toggleGroup = (group) => {
        if (this.state.selectedGroup !== group || !this.state.selectedGroup) {
            this.setState({ selectedGroup: group });
        } else {
            this.setState({ selectedGroup: "" });
        }
    };

    handleAdd = (newGroup) => {
        this.props.onAdd(this.props.refId, {
            group_id: newGroup.id,
            build: newGroup.build,
            modify: newGroup.modify,
            modify_otu: newGroup.modify_otu,
            remove: newGroup.remove
        });
        this.setState(getInitialState());
    };

    handleHide = () => {
        this.setState({ showAdd: false });
    };

    render () {

        if (!this.props.groupList) {
            return <LoadingPlaceholder />;
        }

        const otherGroups = getOtherGroups(this.props.groupList, this.props.groups);
        const currentGroups = this.props.groups;

        const listComponents = currentGroups.length
            ? map(currentGroups, group =>
                <MemberEntry
                    key={group.id}
                    onEdit={this.edit}
                    onRemove={this.handleRemove}
                    onToggleSelect={this.toggleGroup}
                    id={group.id}
                    permissions={{
                        build: group.build,
                        modify: group.modify,
                        modify_otu: group.modify_otu,
                        remove: group.remove
                    }}
                    isSelected={this.state.selectedGroup === group.id}
                />)
            : <div>No groups assigned</div>;

        return (
            <div>
                <Row>
                    <Col xs={6} md={6}>
                        <Flex alignItems="center">
                            <FlexItem grow={1} >
                                <h5><strong>Groups</strong></h5>
                            </FlexItem>
                            <FlexItem>
                                <Icon
                                    name="plus-square"
                                    bsStyle="primary"
                                    tip="Add Group"
                                    onClick={this.add}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>

                    <Col smHidden md={6} />
                </Row>
                <Row>
                    <Col xs={12} md={6} mdPush={6}>
                        <Panel>
                            <Panel.Body>
                                Edit permissions for, add, or remove groups that can access this reference.
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col xs={12} md={6} mdPull={6}>
                        <Panel>
                            <Panel.Body>
                                {listComponents}
                            </Panel.Body>
                        </Panel>
                    </Col>
                    <Col smHidden md={6} />
                </Row>

                <AddReferenceMember
                    show={this.state.showAdd}
                    list={otherGroups}
                    onAdd={this.handleAdd}
                    onHide={this.handleHide}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    refId: state.references.detail.id,
    groups: state.references.detail.groups,
    groupList: state.groups.list
});

const mapDispatchToProps = (dispatch) => ({

    onAdd: (refId, group) => {
        dispatch(addReferenceGroup(refId, group));
    },

    onEdit: (refId, groupId, update) => {
        dispatch(editReferenceGroup(refId, groupId, update));
    },

    onRemove: (refId, groupId) => {
        dispatch(removeReferenceGroup(refId, groupId));
    },

    onListGroups: () => {
        dispatch(listGroups());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceGroups);
