import styled from "styled-components";
import { borderRadius, boxShadow } from "../../../../app/theme";
import { Box } from "../../../../base";

export const SidebarProperty = styled(Box)`
    background-color: ${props => props.theme.color.greyLightest};
    border: none;
    border-radius: ${borderRadius.md};
    box-shadow: ${boxShadow.sm};
    margin-bottom: 15px;
`;
