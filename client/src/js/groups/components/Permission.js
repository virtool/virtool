import React from "react";
import styled from "styled-components";
import { Checkbox, SelectBoxGroupSection } from "../../base";

const StyledGroupPermission = styled(SelectBoxGroupSection)`
    user-select: none;
`;

export const GroupPermission = ({ active, permission, onClick }) => (
    <StyledGroupPermission active={active} onClick={onClick}>
        <Checkbox checked={active} label={permission} />
    </StyledGroupPermission>
);
