import styled from "styled-components";
import { Box } from "./Box";

export const SelectBox = styled(Box)`
    border: 1px ${props => (props.active ? props.theme.color.primary : props.theme.color.greyLight)} solid;

    div {
        font-weight: bold;
    }

    span {
        font-size: 12px;
    }
`;

export const SelectBoxContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-gap: 11px;
`;
