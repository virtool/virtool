import styled from "styled-components";
import { getBorder } from "../app/theme";

export const Key = styled.kbd`
    display: inline-block;
    border: ${getBorder};
    border-radius: ${props => props.theme.borderRadius.sm};
    box-shadow: ${props => props.theme.boxShadow.inset};
    height: 20px;
    line-height: 10px;
    padding: 3px 5px;
    vertical-align: middle;
    width: 20px;
`;
