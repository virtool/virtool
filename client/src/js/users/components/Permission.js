import React from "react";
import styled from "styled-components";
import { BoxGroupSection, Icon } from "../../base";

const StyledPermissionIcon = styled(Icon)`
    margin-right: 15px;
`;

const PermissionIcon = ({ value }) => (
    <StyledPermissionIcon name={value ? "check" : "times"} color={value ? "green" : "red"} fixedWidth />
);

const StyledPermissionItem = styled(BoxGroupSection)`
    align-items: center;
    display: flex;
`;

export const PermissionItem = ({ permission, value }) => {
    if (value) {
        return (
            <StyledPermissionItem>
                <PermissionIcon value={value} /> <code>{permission}</code>
            </StyledPermissionItem>
        );
    }
    return (
        <StyledPermissionItem>
            <PermissionIcon value={value} /> <code>{permission}</code>
        </StyledPermissionItem>
    );
};
