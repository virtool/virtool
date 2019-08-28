import { capitalize, includes, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";

import { BoxGroup, BoxGroupHeader, BoxGroupSection, Input, LoadingPlaceholder, Panel } from "../../base";
import { listGroups } from "../../groups/actions";
import { updateSampleRights } from "../actions";
import { getCanModifyRights } from "../selectors";

class SampleRights extends React.Component {
    componentDidMount() {
        this.props.onListGroups();
    }

    handleChangeGroup = e => {
        this.props.onChangeGroup(this.props.sampleId, e.target.value);
    };

    handleChangeRights = (e, scope) => {
        this.props.onChangeRights(this.props.sampleId, scope, e.target.value);
    };

    render() {
        if (this.props.groups === null) {
            return <LoadingPlaceholder />;
        }

        if (!this.props.canModifyRights) {
            return (
                <Panel>
                    <Panel.Body>Not allowed</Panel.Body>
                </Panel>
            );
        }

        const groupRights = (this.props.group_read ? "r" : "") + (this.props.group_write ? "w" : "");
        const allRights = (this.props.all_read ? "r" : "") + (this.props.all_write ? "w" : "");

        const nameOptionComponents = map(this.props.groups, group => (
            <option key={group.id} value={group.id}>
                {capitalize(group.id)}
            </option>
        ));

        return (
            <BoxGroup>
                <BoxGroupHeader>
                    <h2>Sample Rights</h2>
                    <p>Control who can read and write this sample and which user group owns the sample.</p>
                </BoxGroupHeader>
                <BoxGroupSection>
                    <Input type="select" label="Group" value={this.props.group} onChange={this.handleChangeGroup}>
                        <option value="none">None</option>
                        {nameOptionComponents}
                    </Input>

                    <Input
                        type="select"
                        name="groupRights"
                        label="Group Rights"
                        value={groupRights}
                        onChange={e => this.handleChangeRights(e, "group")}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>

                    <Input
                        type="select"
                        name="allUsers"
                        label="All Users' Rights"
                        value={allRights}
                        onChange={e => this.handleChangeRights(e, "all")}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>
                </BoxGroupSection>
            </BoxGroup>
        );
    }
}

const mapStateToProps = state => {
    const { all_read, all_write, group, group_read, group_write, id, user } = state.samples.detail;

    return {
        canModifyRights: getCanModifyRights(state),
        accountId: state.account.id,
        isAdmin: state.account.administrator,
        groups: state.groups.documents,
        ownerId: user.id,
        sampleId: id,
        group,
        group_read,
        group_write,
        all_read,
        all_write
    };
};

const mapDispatchToProps = dispatch => ({
    onListGroups: () => {
        dispatch(listGroups());
    },

    onChangeGroup: (sampleId, groupId) => {
        dispatch(updateSampleRights(sampleId, { group: groupId }));
    },

    onChangeRights: (sampleId, scope, value) => {
        const update = {
            [`${scope}_read`]: includes(value, "r"),
            [`${scope}_write`]: includes(value, "w")
        };

        dispatch(updateSampleRights(sampleId, update));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleRights);
