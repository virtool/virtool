import React from "react";
import styled from "styled-components";
import { Box, Checkbox } from "../../base";

const SettingsCheckboxContainer = styled.div`
    padding-right: 10px;
`;

const SettingsCheckboxChildren = styled.div`
    padding-right: 20px;
`;

const StyledSettingsCheckbox = styled(Box)`
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding-right: 20px;

    small {
        color: #4a5568;
        font-size: 13px;
    }

    strong {
        display: block;
        font-size: 14px;
        margin-bottom: 3px;
        padding-bottom: 5px;
    }
`;

export const SettingsCheckbox = ({ children, enabled, onToggle }) => (
    <StyledSettingsCheckbox>
        <SettingsCheckboxChildren>{children}</SettingsCheckboxChildren>
        <SettingsCheckboxContainer>
            <Checkbox checked={enabled} onClick={() => onToggle(!enabled)} />
        </SettingsCheckboxContainer>
    </StyledSettingsCheckbox>
);
