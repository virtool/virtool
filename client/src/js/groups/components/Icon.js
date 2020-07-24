import styled from "styled-components";
import { Icon } from "../../base";

export const GroupIcon = styled(Icon).attrs(() => ({ name: "users" }))`
    align-items: center;
    background-color: ${props => props.theme.color.greyLightest};
    border-radius: 100%;
    box-shadow: ${props => props.theme.boxShadow.sm};
    display: flex;
    height: 24px;
    justify-content: center;
    width: 24px;
`;

export default GroupIcon;
