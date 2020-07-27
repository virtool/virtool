import React from "react";
import styled from "styled-components";
import { getFontSize } from "../../app/theme";
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

    h2 {
        font-size: ${props => props.theme.fontSize.lg};
        font-weight: ${props => props.theme.fontWeight.thick};
        margin: 0 0 3px;
        padding-bottom: 5px;
    }

    small {
        color: ${props => props.theme.color.greyDarkest};
        font-size: ${getFontSize("md")};
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
