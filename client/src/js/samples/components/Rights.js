import React from "react";
import { connect } from "react-redux";
import { capitalize, includes, map } from "lodash-es";
import { Panel } from "react-bootstrap";

import { Alert, Input, LoadingPlaceholder } from "../../base";
import { listGroups } from "../../groups/actions";
import { updateSampleRights } from "../actions";

class SampleRights extends React.Component {
    componentDidMount() {
        if (!this.props.groupsFetched) {
            this.props.onListGroups();
        }
    }

    isOwnerOrAdministrator = () =>
        includes(this.props.groups, this.props.group) ||
        this.props.accountId === this.props.ownerId ||
        this.props.isAdmin;

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

        if (!this.isOwnerOrAdministrator()) {
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
            <div>
                <Alert bsStyle="info" icon="info-circle">
                    Restrict who can read and write this sample and which user group owns the sample.
                </Alert>

                <Panel>
                    <Panel.Body>
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
                    </Panel.Body>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = state => {
    const { all_read, all_write, group, group_read, group_write, id, user } = state.samples.detail;

    return {
        accountId: state.account.id,
        isAdmin: state.account.administrator,
        groups: state.groups.list,
        groupsFetched: state.groups.fetched,
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
