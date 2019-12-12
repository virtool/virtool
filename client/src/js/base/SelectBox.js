import styled from "styled-components";
import { Box } from "./Box";

export const SelectBox = styled(Box)`
    border: 1px ${props => (props.active ? props.theme.color.primary : props.theme.color.greyLight)} solid;

    div {
        font-weight: bold;
        font-size: 12px;
    }
    span {
        font-size: 11px;
    }
`;
