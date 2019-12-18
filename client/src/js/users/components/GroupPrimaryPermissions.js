import React from "react";
import styled from "styled-components";
import { device } from "../../base";
import UserPermissions from "./Permissions";
import UserGroups from "./Groups";
import PrimaryGroup from "./PrimaryGroup";

const StyledGroupPermissions = styled.div`
    @media (min-width: ${device.tablet}) {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-gap: 17px;
    }
`;

export const GroupPrimaryPermissions = () => (
    <StyledGroupPermissions>
        <div>
            <UserGroups />

            <PrimaryGroup />
        </div>
        <UserPermissions />
    </StyledGroupPermissions>
);
