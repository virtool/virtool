import styled from "styled-components";
import React, { useCallback } from "react";
import { map, capitalize } from "lodash-es";
import { connect } from "react-redux";
import { InputError } from "../../base";
import { editUser } from "../actions";

export const StyledGroupOption = styled.option`
    text-transform: capitalize;
`;

export const PrimaryGroup = ({ groups, id, primaryGroup, onSetPrimaryGroup }) => {
    const handleSetPrimaryGroup = useCallback(e =>
        onSetPrimaryGroup(id, e.target.value === "none" ? "" : e.target.value)
    );

    const groupOptions = map(groups, groupId => (
        <StyledGroupOption key={groupId} value={groupId}>
            {capitalize(groupId)}
        </StyledGroupOption>
    ));

    return (
        <div>
            <label>Primary Group</label>
            <InputError type="select" value={primaryGroup} onChange={handleSetPrimaryGroup}>
                <option key="none" value="none">
                    None
                </option>
                {groupOptions}
            </InputError>
        </div>
    );
};

export const mapStateToProps = state => {
    const { groups, id, primary_group } = state.users.detail;
    return {
        groups,
        id,
        primaryGroup: primary_group
    };
};

export const mapDispatchToProps = dispatch => ({
    onSetPrimaryGroup: (userId, groupId) => {
        dispatch(editUser(userId, { primary_group: groupId }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(PrimaryGroup);
