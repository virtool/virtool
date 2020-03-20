import React from "react";
import styled from "styled-components";
import { DangerBoxGroupSection, Icon } from "../../base";

const StyledPermissionItem = styled(DangerBoxGroupSection)`
    align-items: center;
    display: flex;
    justify-content: space-between;
`;

export const PermissionItem = ({ permission, value }) => {
    if (value) {
        return (
            <StyledPermissionItem>
                <code>{permission}</code> <Icon name={value ? "check" : "times"} />
            </StyledPermissionItem>
        );
    }
    return (
        <StyledPermissionItem>
            <code>{permission}</code> <Icon name={value ? "check" : "times"} />
        </StyledPermissionItem>
    );
};
