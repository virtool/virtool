import React from "react";
import { map, capitalize } from "lodash-es";
import { connect } from "react-redux";
import { InputError } from "../../base";
import { editUser } from "../actions";

export class PrimaryGroup extends React.Component {
    handleSetPrimaryGroup = e => {
        const value = e.target.value === "none" ? "" : e.target.value;
        this.props.onSetPrimaryGroup(this.props.detail.id, value);
    };

    render() {
        const groupOptions = map(this.props.groups, groupId => (
            <option key={groupId} value={groupId}>
                {capitalize(groupId)}
            </option>
        ));
        return (
            <div>
                <label>Primary Group</label>

                <InputError type="select" value={this.props.primary_group} onChange={this.handleSetPrimaryGroup}>
                    <option key="none" value="none">
                        None
                    </option>
                    {groupOptions}
                </InputError>
            </div>
        );
    }
}
export const mapStateToProps = state => ({
    group: state.users.detail.group,
    primary_group: state.users.detail.primary_group
});

export const mapDispatchToProps = dispatch => ({
    onSetPrimaryGroup: (userId, groupId) => {
        dispatch(editUser(userId, { primary_group: groupId }));
    }
});
export default connect(
    mapStateToProps,
    mapDispatchToProps
)(PrimaryGroup);
