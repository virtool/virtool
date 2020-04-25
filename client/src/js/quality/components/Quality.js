import React from "react";
import styled from "styled-components";
import { useElementSize } from "../../utils/hooks";
import { QualityChart } from "./Chart";
import { drawBasesChart } from "./Bases";
import { drawNucleotidesChart } from "./Nucleotides";
import { drawSequencesChart } from "./Sequences";

const QualityTitle = styled.h5`
    display: flex;
    justify-content: space-between;
`;

export const Quality = ({ bases, composition, sequences }) => {
    const [ref, { width }] = useElementSize();

    return (
        <div ref={ref}>
            {width && (
                <React.Fragment>
                    <QualityTitle>
                        <strong>Quality Distribution at Read Positions</strong>
                    </QualityTitle>
                    <QualityChart createChart={drawBasesChart} data={bases} width={width} />

                    <h5>
                        <strong>Nucleotide Composition at Read Positions</strong>
                    </h5>
                    <QualityChart createChart={drawNucleotidesChart} data={composition} width={width} />

                    <h5>
                        <strong>Read-wise Quality Occurrence</strong>
                    </h5>
                    <QualityChart createChart={drawSequencesChart} data={sequences} width={width} />
                </React.Fragment>
            )}
        </div>
    );
};
