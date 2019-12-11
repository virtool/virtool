import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { InputError } from "../../base";

export class PrimaryGroup extends React.Component {
    handleSetPrimaryGroup = e => {
        const value = e.target.value === "none" ? "" : e.target.value;
        this.props.onSetPrimaryGroup(this.props.detail.id, value);
    };

    render() {
        const groupOptions = map(this.props.detail.groups, groupId => (
            <option key={groupId} value={groupId}>
                {capitalize(groupId)}
            </option>
        ));
        return (
            <div>
                <label>Primary Group</label>
                <InputError type="select" value={this.props.detail.primary_group} onChange={this.handleSetPrimaryGroup}>
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
    detail: state.users.detail,
    activeUser: state.account.id,
    activeUserIsAdmin: state.account.administrator,
    groups: state.groups.list,
    groupsFetched: state.groups.fetched,
    error: get(state, "errors.GET_USER_ERROR.message", "")
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
