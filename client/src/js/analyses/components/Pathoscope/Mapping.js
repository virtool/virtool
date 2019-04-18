import numbro from "numbro";
import React from "react";
import { connect } from "react-redux";
import { Label, ProgressBar } from "react-bootstrap";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Box, Flex, FlexItem, Icon } from "../../../base";
import { getColor } from "../../../base/utils";
import { toThousand } from "../../../utils/utils";

const AnalysisMappingReference = ({ index, reference }) => (
    <StyledAnalysisMappingReference>
        <Link to={`/refs/${reference.id}`}>{reference.name}</Link>
        <Label style={{ marginLeft: "5px" }}>{index.version}</Label>
    </StyledAnalysisMappingReference>
);

const AnalysisMappingSubtraction = ({ subtraction }) => (
    <StyledAnalysisMappingSubtraction to={`/subtractions/${subtraction.id}`}>
        {subtraction.id}
    </StyledAnalysisMappingSubtraction>
);

const StyledAnalysisMappingReference = styled.div`
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    margin-left: 10px;
`;

const StyledAnalysisMappingSubtraction = styled(Link)`
    flex: 0 0 auto;
    margin-left: 10px;
`;

const AnalysisMappingLegendIcon = styled(Icon)`
    color: ${props => getColor(props.color)};
    margin-right: 3px;
`;

const AnalysisMappingLegendLabel = styled.div`
    align-items: center;
    display: flex;
    margin-bottom: 5px;
`;

const AnalysisMappingLegendCount = styled.div`
    padding-left: 50px;
    text-align: right;
`;

const StyledAnalysisMapping = styled(Box)`
    flex: 1 0 auto;
    margin-bottom: 30px;
`;

export const AnalysisMapping = ({ index, reference, subtraction, toReference, total, toSubtraction = 0 }) => {
    const referencePercent = toReference / total;
    const subtractionPercent = toSubtraction / total;
    const totalMapped = toReference + toSubtraction;
    const sumPercent = totalMapped / total;

    return (
        <StyledAnalysisMapping>
            <h3>
                <Flex alignItems="flex-end">
                    <FlexItem grow={1}>{numbro(sumPercent).format({ output: "percent", mantissa: 2 })} mapped</FlexItem>
                    <small>
                        {toThousand(totalMapped)} / {toThousand(total)}
                    </small>
                </Flex>
            </h3>

            <div>
                <ProgressBar>
                    <ProgressBar now={referencePercent * 100} />
                    <ProgressBar bsStyle="warning" now={subtractionPercent * 100} />
                </ProgressBar>
            </div>

            <Flex>
                <FlexItem>
                    <AnalysisMappingLegendLabel>
                        <AnalysisMappingLegendIcon name="circle" color="blue" />
                        <AnalysisMappingReference reference={reference} index={index} />
                    </AnalysisMappingLegendLabel>
                    <AnalysisMappingLegendLabel>
                        <AnalysisMappingLegendIcon name="circle" color="yellow" />
                        <AnalysisMappingSubtraction subtraction={subtraction} />
                    </AnalysisMappingLegendLabel>
                </FlexItem>
                <FlexItem>
                    <AnalysisMappingLegendCount>{toThousand(toReference)}</AnalysisMappingLegendCount>
                    <AnalysisMappingLegendCount>{toThousand(toSubtraction)}</AnalysisMappingLegendCount>
                </FlexItem>
            </Flex>
        </StyledAnalysisMapping>
    );
};

const mapStateToProps = state => {
    const { index, read_count, reference, subtracted_count } = state.analyses.detail;

    return {
        index,
        reference,
        subtraction: state.samples.detail.subtraction,
        toReference: read_count,
        toSubtraction: subtracted_count,
        total: state.samples.detail.quality.count
    };
};

export default connect(mapStateToProps)(AnalysisMapping);
