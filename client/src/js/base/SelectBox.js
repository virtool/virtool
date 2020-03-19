import styled from "styled-components";
import { Box } from "./Box";

export const SelectBox = styled(Box)`
    border: 1px ${props => (props.active ? props.theme.color.blue : props.theme.color.greyLight)} solid;
    border-radius: ${props => props.theme.borderRadius.sm};

    div {
        font-weight: bold;
    }

    span {
        font-size: 11px;
    }
`;
