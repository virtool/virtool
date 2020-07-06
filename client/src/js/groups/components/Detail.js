import { filter, includes, map, transform } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";
import { Box, BoxGroup, BoxGroupHeader, BoxGroupSection, Button, Icon, Loader, NoneFoundSection } from "../../base";
import { GroupPermission } from "./Permission";

const EmptyGroupDetail = styled(Box)`
    align-items: center;
    display: flex;
    min-height: 220px;
    justify-content: center;

    i {
        margin-right: 3px;
    }
`;

const PermissionsHeader = styled(BoxGroupHeader)`
    flex-direction: row;
    font-weight: bold;
    justify-content: space-between;
`;

const StyledGroupDetail = styled.div`
    display: flex;
    flex-direction: column;
`;

export const GroupDetail = ({ group, pending, users, onRemove, onSetPermission }) => {
    let members;

    if (!group) {
        return (
            <EmptyGroupDetail>
                <Icon name="exclamation-circle" /> No groups found.
            </EmptyGroupDetail>
        );
    }

    if (group) {
        members = filter(users, user => includes(user.groups, group.id));
    }

    let memberComponents;

    if (members && members.length) {
        memberComponents = map(members, member => (
            <BoxGroupSection key={member.id} spaced>
                {member.id}
            </BoxGroupSection>
        ));
    } else {
        memberComponents = <NoneFoundSection noun="members" />;
    }

    const permissionComponents = transform(
        group.permissions,
        (result, active, permission) => {
            result.push(
                <GroupPermission
                    key={permission}
                    active={active}
                    permission={permission}
                    onClick={() => onSetPermission(group.id, permission, !active)}
                />
            );

            return result;
        },
        []
    );

    const handleRemove = useCallback(() => onRemove(group.id), [group.id]);

    return (
        <StyledGroupDetail>
            <BoxGroup>
                <PermissionsHeader>
                    <span>Permissions</span>
                    {pending ? <Loader size="16px" color="currentColor" /> : null}
                </PermissionsHeader>
                {permissionComponents}
            </BoxGroup>

            <BoxGroup>
                <BoxGroupHeader>Members</BoxGroupHeader>
                {memberComponents}
            </BoxGroup>

            <Button icon="trash" color="red" onClick={handleRemove}>
                Remove Group
            </Button>
        </StyledGroupDetail>
    );
};
