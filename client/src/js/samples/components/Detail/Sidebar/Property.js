import styled from "styled-components";
import { borderRadius, boxShadow } from "../../../../app/theme";

export const SidebarProperty = styled.div`
    background-color: ${props => props.theme.color.greyLightest};
    border-radius: ${borderRadius.md};
    box-shadow: ${boxShadow.sm};
    padding: 0px 10px 5px 10px;
    margin-bottom: 15px;
`;
