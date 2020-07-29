import styled from "styled-components";
import { getBorder } from "../app/theme";

export const SectionHeader = styled.h3`
    border-bottom: ${getBorder};
    font-size: ${props => props.theme.fontSize.lg};
    margin-bottom: 10px;
    padding-bottom: 5px;
`;
