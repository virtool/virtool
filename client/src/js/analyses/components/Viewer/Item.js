import styled from "styled-components";
import { Box } from "../../../base";

export const AnalysisViewerItem = styled(Box)`
    border-bottom: none;
    border-left: none;
    border-radius: 0;
    margin: 0;
    ${props => (props.selected ? `box-shadow: inset 3px 0 0 ${props.theme.color.primary};` : "")}
`;
