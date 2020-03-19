import React from "react";
import { connect } from "react-redux";
import { InputGroup, InputLabel, Select } from "../../base";
import { editUser } from "../actions";
import { getCanModifyUser } from "../selectors";

export const UserRole = ({ canModifyUser, id, role, onSetUserRole }) => {
    if (canModifyUser) {
        return (
            <InputGroup>
                <InputLabel>User Role</InputLabel>
                <Select value={role} onChange={e => onSetUserRole(id, e.target.value)}>
                    <option key="administrator" value="administrator">
                        Administrator
                    </option>
                    <option key="limited" value="limited">
                        Limited
                    </option>
                </Select>
            </InputGroup>
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    canModifyUser: getCanModifyUser(state),
    id: state.users.detail.id,
    role: state.users.detail.administrator ? "administrator" : "limited"
});

export const mapDispatchToProps = dispatch => ({
    onSetUserRole: (userId, value) => {
        dispatch(editUser(userId, { administrator: value === "administrator" }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UserRole);
