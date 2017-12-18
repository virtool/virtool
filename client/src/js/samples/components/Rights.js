import React from "react";
import { includes } from "lodash";
import { connect } from "react-redux";
import { Alert, Panel } from "react-bootstrap";
import { Input, LoadingPlaceholder } from "../../base";
import { updateSampleGroup, updateSampleRights } from "../actions";
import { listGroups } from "../../groups/actions";

class SampleRights extends React.Component {

    componentDidMount () {
        if (this.isOwnerOrAdministrator()) {
            this.props.onListGroups();
        }
    }

    isOwnerOrAdministrator = () => (
        includes(this.props.groups, this.props.group) || this.props.accountId === this.props.ownerId
    );

    render () {
        if (!this.isOwnerOrAdministrator()) {
            return <Panel>Not allowed</Panel>;
        }

        if (this.props.groups === null) {
            return <LoadingPlaceholder />;
        }

        const groupRights = (this.props.group_read ? "r" : "") + (this.props.group_write ? "w" : "");
        const allRights = (this.props.all_read ? "r" : "") + (this.props.all_write ? "w" : "");

        const nameOptionComponents = this.props.groups.map(group =>
            <option key={group.id} value={group.id}>{group.id}</option>
        );

        return (
            <div>
                <Alert bsStyle="warning">
                    Restrict who can read and write this sample and which user group owns the sample.
                </Alert>

                <Panel>
                    <Input
                        type="select"
                        label="Group"
                        value={this.props.group}
                        onChange={(e) => this.props.onChangeGroup(this.props.sampleId, e.target.value)}
                    >
                        <option value="none">None</option>
                        {nameOptionComponents}
                    </Input>

                    <Input
                        type="select"
                        label="Group Rights"
                        value={groupRights}
                        onChange={(e) => this.props.onChangeRights(this.props.sampleId, "group", e.target.value)}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>

                    <Input
                        type="select"
                        label="All Users' Rights"
                        value={allRights}
                        onChange={(e) => this.props.onChangeRights(this.props.sampleId, "all", e.target.value)}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>
                </Panel>
            </div>
        );
    }
}

const mapStateToProps = state => {
    const { group_read, group_write, all_read, all_write } = state.samples.detail;

    return {
        accountId: state.account.id,
        group: state.samples.detail.group,
        groups: state.groups.documents,
        ownerId: state.samples.detail.user.id,
        sampleId: state.samples.detail.id,
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
        dispatch(updateSampleGroup(sampleId, groupId));
    },

    onChangeRights: (sampleId, name, value) => {
        const update = {};

        update[`${name}_read`] = value.includes("r");
        update[`${name}_write`] = value.includes("w");

        dispatch(updateSampleRights(sampleId, update));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleRights);

export default Container;
