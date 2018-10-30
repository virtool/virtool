import React from "react";
import { Label } from "react-bootstrap";

import { Flex, FlexItem } from "../../base/index";

export default function AnalysisValueLabel({ bsStyle, label, value }) {
    return (
        <Flex alignItems="center" style={{ height: "21px" }}>
            <FlexItem>
                <Label>{label}</Label>
            </FlexItem>
            <FlexItem pad={5}>
                <strong className={`text-${bsStyle}`}>{value}</strong>
            </FlexItem>
        </Flex>
    );
}
