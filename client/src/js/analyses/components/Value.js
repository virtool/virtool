import React from "react";
import styled from "styled-components";
import { colors } from "../../base/utils";

const AnalysisValueLabel = styled.div`
    color: #777777;
    font-size: ${props => props.theme.fontSize.sm};
    font-weight: ${props => props.theme.fontWeight.thick};
    text-align: right;
    text-transform: uppercase;
`;

const AnalysisValueNumber = styled.div`
    color: ${props => colors[props.color]};
    font-size: ${props => props.theme.fontSize.md};
    font-weight: ${props => props.theme.fontWeight.thick};
    text-align: right;
`;

const AnalysisValue = styled.div`
    margin-left: 10px;
    width: 60px;
`;

export default ({ color, label, value }) => (
    <AnalysisValue>
        <AnalysisValueNumber color={color}>{value}</AnalysisValueNumber>
        <AnalysisValueLabel>{label}</AnalysisValueLabel>
    </AnalysisValue>
);
