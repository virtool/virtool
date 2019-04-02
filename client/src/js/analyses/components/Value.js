import React from "react";
import styled from "styled-components";
import { colors } from "../../base/utils";

const AnalysisValueLabel = styled.div`
    color: #777777;
    font-size: 12px;
    font-weight: bold;
    text-align: right;
    text-transform: uppercase;
`;

const AnalysisValueNumber = styled.div`
    color: ${props => colors[props.color]};
    font-size: 14px;
    font-weight: bold;
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
