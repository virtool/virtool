import styled from "styled-components";
import { Icon } from "../../base";

export const GroupIcon = styled(Icon).attrs(() => ({ name: "users" }))`
    align-items: center;
    background-color: ${props => props.theme.color.greyLightest};
    border-radius: 12px;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
    display: flex;
    height: 24px;
    justify-content: center;
    width: 24px;
`;

export default GroupIcon;
