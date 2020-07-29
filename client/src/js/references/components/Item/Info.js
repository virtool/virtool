import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../../app/theme";
import { Box } from "../../../base";

export const ReferenceItemInfo = styled(Box)`
    background-color: #f7fafc;
    border-color: #718096;
    border-radius: 3px;
    font-weight: bold;
    height: 100%;
    margin: 0;
    padding: 8px 11px;

    h4 {
        font-weight: ${getFontWeight("thick")};
        font-size: ${getFontSize("md")};
        margin: 0 0 3px;
    }

    p {
        font-size: ${getFontSize("sm")};
        font-weight: ${props => props.theme.fontWeight.normal};
        margin: 0;
    }
`;
