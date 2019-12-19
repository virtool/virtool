import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { InputError } from "../../base";
import { editUser } from "../actions";
import { getCanModifyUser } from "../selectors";

const StyledUserRole = styled.div`
    margin-bottom: 15px;
`;

export const UserRole = ({ canModifyUser, id, role, onSetUserRole }) => {
    if (canModifyUser) {
        return (
            <StyledUserRole>
                <label>User Role</label>
                <InputError type="select" value={role} onChange={e => onSetUserRole(id, e.target.value)}>
                    <option key="administrator" value="administrator">
                        Administrator
                    </option>
                    <option key="limited" value="limited">
                        Limited
                    </option>
                </InputError>
            </StyledUserRole>
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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(UserRole);
