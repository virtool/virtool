import React from "react";
import { connect } from "react-redux";
import { capitalize, includes, map } from "lodash-es";
import { Alert, Panel } from "react-bootstrap";
import { Icon, Input, LoadingPlaceholder } from "../../base";
import { updateSampleGroup, updateSampleRights } from "../actions";
import { listGroups } from "../../groups/actions";

class SampleRights extends React.Component {

    componentDidMount () {
        this.props.onListGroups();
    }

    isOwnerOrAdministrator = () => (
        includes(this.props.groups, this.props.group) || this.props.accountId === this.props.ownerId
    );

    handleChangeGroup = (e) => {
        this.props.onChangeGroup(this.props.sampleId, e.target.value);
    };

    handleChangeRights = (e) => {
        this.props.onChangeRights(this.props.sampleId, "group", e.target.value);
    };

    render () {
        if (this.props.groups === null) {
            return <LoadingPlaceholder />;
        }

        if (!this.isOwnerOrAdministrator()) {
            return <Panel>Not allowed</Panel>;
        }

        const groupRights = (this.props.group_read ? "r" : "") + (this.props.group_write ? "w" : "");
        const allRights = (this.props.all_read ? "r" : "") + (this.props.all_write ? "w" : "");

        const nameOptionComponents = map(this.props.groups, group =>
            <option key={group.id} value={group.id}>
                {capitalize(group.id)}
            </option>
        );

        return (
            <div>
                <Alert bsStyle="info">
                    <Icon name="info" />
                    <span> Restrict who can read and write this sample and which user group owns the sample.</span>
                </Alert>

                <Panel>
                    <Input
                        type="select"
                        label="Group"
                        value={this.props.group}
                        onChange={this.handleChangeGroup}
                    >
                        <option value="none">None</option>
                        {nameOptionComponents}
                    </Input>

                    <Input
                        type="select"
                        label="Group Rights"
                        value={groupRights}
                        onChange={this.handleChangeRights}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>

                    <Input
                        type="select"
                        label="All Users' Rights"
                        value={allRights}
                        onChange={this.handleChangeRights}
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

    const { all_read, all_write, group, group_read, group_write, id, user } = state.samples.detail;

    return {
        accountId: state.account.id,
        groups: state.groups.list,
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
        dispatch(updateSampleGroup(sampleId, groupId));
    },

    onChangeRights: (sampleId, name, value) => {
        const update = {
            [`${name}_read`]: includes(value, "r"),
            [`${name}_write`]: includes(value, "w")
        };

        dispatch(updateSampleRights(sampleId, update));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SampleRights);

export default Container;
