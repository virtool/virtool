import React from "react";
import { map } from "lodash-es";
import styled from "styled-components";
import { connect } from "react-redux";
import { InputError, Flex } from "../../base";
import { UserGroups } from "./Groups";
import UserPermissions from "./Permissions";

const StyledGroupPermissions = styled.div``;

const groupOptions = detailGroup => {
    map(
        { detailGroup },
        groupId,
        <option key={groupId} value={groupId}>
            {capitalize(groupId)}
        </option>
    );
};

export const GroupPermissions = ({
    detailId,
    detailGroup,
    detailPrimary_group,
    handleSetPrimaryGroup,
    detailPermission
}) => (
    <StyledGroupPermissions>
        <label>Groups</label>
        <label>Primary Group</label>
        <InputError type="select" value={detailPrimary_group} onChange={handleSetPrimaryGroup}>
            <option key="none" value="none">
                None
            </option>
            <groupOptions detailGroup={detailGroup} />
        </InputError>
        <Flex alignItems="center" justifyContent="space-between">
            <label>Permissions</label>
            <small className="text-muted">Change group membership to modify permissions</small>
        </Flex>
        <UserPermissions permissions={detailPermission} />
    </StyledGroupPermissions>
);
// <UserGroups userId={detailId} memberGroups={detaiLGroup} />
// {groupOptions}
export const mapStateToProps = state => ({
    detail: state.users.detail
});

export default connect(mapStateToProps)(GroupPermissions);
