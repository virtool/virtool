import React from "react";
import styled from "styled-components";
import { Box, Checkbox } from "../../base";

const SettingsCheckboxContainer = styled.div`
    padding: 10px;
`;

const SettingsCheckboxChildren = styled.div`
    padding-right: 20px;
`;

const StyledSettingsCheckbox = styled(Box)`
    align-items: center;
    display: flex;
    justify-content: space-between;
    padding: 15px 20px 12px 15px;

    small {
        color: #4a5568;
        font-size: 14px;
    }

    h2 {
        display: block;
        font-size: 15px;
        margin: 0 0 3px;
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
