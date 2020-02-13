import { filter, includes, map, transform } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";
import { Box, BoxGroup, BoxGroupHeader, BoxGroupSection, Button, Icon, Label, Loader, Checkbox } from "../../base";

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

const PermissionsItem = styled(BoxGroupSection)`
    display: flex;
    justify-content: space-between;
    align-items: center;
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
            <Label key={member.id} spaced>
                {member.id}
            </Label>
        ));
    } else {
        memberComponents = (
            <div className="text-center">
                <Icon name="info-circle" /> No members found.
            </div>
        );
    }

    const permissionComponents = transform(
        group.permissions,
        (result, value, key) => {
            result.push(
                <PermissionsItem key={key} onClick={() => onSetPermission(group.id, key, !value)}>
                    <code>{key}</code>
                    <Checkbox checked={value} />
                </PermissionsItem>
            );

            return result;
        },
        []
    );

    const handleRemove = useCallback(() => onRemove(group.id), [group.id]);

    return (
        <div>
            <BoxGroup>
                <PermissionsHeader>
                    <span>Permissions</span>
                    {pending ? <Loader size="16px" color="currentColor" /> : null}
                </PermissionsHeader>
                {permissionComponents}
            </BoxGroup>

            <BoxGroup>
                <BoxGroupHeader>Members</BoxGroupHeader>
                <BoxGroupSection>{memberComponents}</BoxGroupSection>
            </BoxGroup>

            <Button icon="trash" bsStyle="danger" onClick={handleRemove} block>
                Remove Group
            </Button>
        </div>
    );
};
