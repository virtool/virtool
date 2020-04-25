import { capitalize, includes, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";

import {
    Box,
    BoxGroup,
    BoxGroupHeader,
    BoxGroupSection,
    InputGroup,
    InputLabel,
    LoadingPlaceholder,
    Select
} from "../../base";
import { listGroups } from "../../groups/actions";
import { updateSampleRights } from "../actions";
import { getCanModifyRights } from "../selectors";

export class SampleRights extends React.Component {
    componentDidMount() {
        this.props.onListGroups();
    }

    handleChangeGroup = e => {
        this.props.onChangeGroup(this.props.sampleId, e.target.value);
    };

    handleChangeRights = (e, scope) => {
        this.props.onChangeRights(this.props.sampleId, scope, e.target.value);
    };

    getValueGroupRights = () => (this.props.group_read ? "r" : "") + (this.props.group_write ? "w" : "");
    getValueAllRights = () => (this.props.all_read ? "r" : "") + (this.props.all_write ? "w" : "");

    render() {
        if (this.props.groups === null) {
            return <LoadingPlaceholder />;
        }

        if (!this.props.canModifyRights) {
            return <Box>Not allowed</Box>;
        }

        const groupRights = this.getValueGroupRights();
        const allRights = this.getValueAllRights();

        const groupOptionComponents = map(this.props.groups, group => (
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
                    <InputGroup>
                        <InputLabel>Group</InputLabel>
                        <Select value={this.props.group} onChange={this.handleChangeGroup}>
                            <option value="none">None</option>
                            {groupOptionComponents}
                        </Select>
                    </InputGroup>

                    <InputGroup>
                        <InputLabel>Group Rights</InputLabel>
                        <Select
                            name="groupRights"
                            value={groupRights}
                            onChange={e => this.handleChangeRights(e, "group")}
                        >
                            <option value="">None</option>
                            <option value="r">Read</option>
                            <option value="rw">Read & write</option>
                        </Select>
                    </InputGroup>

                    <InputGroup>
                        <InputLabel>All Users' Rights</InputLabel>
                        <Select
                            name="allUsers"
                            label="All Users' Rights"
                            value={allRights}
                            onChange={e => this.handleChangeRights(e, "all")}
                        >
                            <option value="">None</option>
                            <option value="r">Read</option>
                            <option value="rw">Read & write</option>
                        </Select>
                    </InputGroup>
                </BoxGroupSection>
            </BoxGroup>
        );
    }
}

export const mapStateToProps = state => {
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

export const mapDispatchToProps = dispatch => ({
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

export default connect(mapStateToProps, mapDispatchToProps)(SampleRights);
