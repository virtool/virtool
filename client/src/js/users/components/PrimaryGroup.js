import { capitalize, map } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { InputGroup, InputLabel, Select } from "../../base";
import { editUser } from "../actions";

export const PrimaryGroupOption = styled.option`
    text-transform: capitalize;
`;

export const PrimaryGroup = ({ groups, id, primaryGroup, onSetPrimaryGroup }) => {
    const handleSetPrimaryGroup = useCallback(
        e => onSetPrimaryGroup(id, e.target.value === "none" ? "" : e.target.value),
        [id, primaryGroup]
    );

    const groupOptions = map(groups, groupId => (
        <PrimaryGroupOption key={groupId} value={groupId}>
            {capitalize(groupId)}
        </PrimaryGroupOption>
    ));

    return (
        <InputGroup>
            <InputLabel>Primary Group</InputLabel>
            <Select value={primaryGroup} onChange={handleSetPrimaryGroup}>
                <option key="none" value="none">
                    None
                </option>
                {groupOptions}
            </Select>
        </InputGroup>
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
