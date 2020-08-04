import styled from "styled-components";
import { getFontSize } from "../app/theme";
import { VTLogo } from "../base";

export const WallContainer = styled.div`
    align-items: center;
    background-color: ${props => props.theme.color.primary};
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
`;

export const WallDialog = styled.div`
    align-items: stretch;
    background-color: ${props => props.theme.color.white};
    border: none;
    border-radius: ${props => props.theme.borderRadius.md};
    box-shadow: ${props => props.theme.boxShadow.lg};
    display: flex;
    flex-direction: column;
    margin-bottom: 260px;
    padding: 10px 15px;
    width: 340px;
`;

export const WallDialogFooter = styled.div`
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-top: 15px;

    & > span {
        color: ${props => props.theme.color.red};
        font-size: ${getFontSize("xs")};
    }
`;

export const WallLogo = styled(VTLogo)`
    color: ${props => props.theme.color.white};
    margin-bottom: 20px;
`;
