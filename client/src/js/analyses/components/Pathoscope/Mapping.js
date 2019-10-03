import numbro from "numbro";
import React from "react";
import { connect } from "react-redux";
import { ProgressBar } from "react-bootstrap";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Box, Flex, FlexItem, Icon, Label } from "../../../base";
import { getColor } from "../../../base/utils";
import { toThousand } from "../../../utils/utils";

const StyledAnalysisMappingReference = styled.div`
    align-items: center;
    display: flex;
    flex: 0 0 auto;
    margin-left: 10px;

    ${Label} {
        margin-left: 5px;
    }
`;

export const AnalysisMappingReference = ({ index, reference }) => (
    <StyledAnalysisMappingReference>
        <Link to={`/refs/${reference.id}`}>{reference.name}</Link>
        <Label>{index.version}</Label>
    </StyledAnalysisMappingReference>
);

const StyledAnalysisMappingSubtraction = styled(Link)`
    flex: 0 0 auto;
    margin-left: 10px;
`;

export const AnalysisMappingSubtraction = ({ subtraction }) => (
    <StyledAnalysisMappingSubtraction to={`/subtractions/${subtraction.id}`}>
        {subtraction.id}
    </StyledAnalysisMappingSubtraction>
);

const AnalysisMappingLegendIcon = styled(Icon)`
    color: ${props => getColor(props.color)};
    margin-right: 3px;
`;

const AnalysisMappingLegendLabel = styled.div`
    align-items: center;
    display: flex;
    margin-bottom: 5px;
    justify-content: space-between;
    width: 500px;
`;

const AnalysisMappingLegendCount = styled.div`
    padding-left: 50px;
    text-align: right;
`;

const StyledAnalysisMapping = styled(Box)`
    margin-bottom: 30px;

    h3 {
        align-items: flex-end;
        display: flex;
        justify-content: space-between;
    }
`;

const AnalysisMappingLegendIconReference = styled.div`
    display: flex;
    align-items: center;
`;

export const AnalysisMapping = ({ index, reference, subtraction, toReference, total, toSubtraction = 0 }) => {
    const referencePercent = toReference / total;
    const subtractionPercent = toSubtraction / total;
    const totalMapped = toReference + toSubtraction;
    const sumPercent = totalMapped / total;

    return (
        <StyledAnalysisMapping>
            <h3>
                {numbro(sumPercent).format({ output: "percent", mantissa: 2 })} mapped
                <small>
                    {toThousand(totalMapped)} / {toThousand(total)}
                </small>
            </h3>

            <ProgressBar>
                <ProgressBar now={referencePercent * 100} />
                <ProgressBar bsStyle="warning" now={subtractionPercent * 100} />
            </ProgressBar>

            <Flex>
                <FlexItem>
                    <AnalysisMappingLegendLabel>
                        <AnalysisMappingLegendIconReference>
                            <AnalysisMappingLegendIcon name="circle" color="blue" />
                            <AnalysisMappingReference reference={reference} index={index} />
                        </AnalysisMappingLegendIconReference>
                        <AnalysisMappingLegendCount>{toThousand(toReference)}</AnalysisMappingLegendCount>
                    </AnalysisMappingLegendLabel>

                    <AnalysisMappingLegendLabel>
                        <AnalysisMappingLegendIconReference>
                            <AnalysisMappingLegendIcon name="circle" color="yellow" />
                            <AnalysisMappingSubtraction subtraction={subtraction} />
                        </AnalysisMappingLegendIconReference>
                        <AnalysisMappingLegendCount>{toThousand(toSubtraction)}</AnalysisMappingLegendCount>
                    </AnalysisMappingLegendLabel>
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
