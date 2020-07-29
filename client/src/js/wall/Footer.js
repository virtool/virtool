import styled from "styled-components";
import { getFontSize } from "../app/theme";

export const WallModalFooter = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 15px;

    & > span {
        color: ${props => props.theme.color.red};
        font-size: ${getFontSize("xs")};
    }
`;
