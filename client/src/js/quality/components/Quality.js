import React from "react";
import styled from "styled-components";
import { Button } from "../../base";
import Chart from "./Chart";
import Bases from "./Bases";
import Nucleotides from "./Nucleotides";
import Sequences from "./Sequences";

const StyledTitle = styled.h5`
    display: flex;
    justify-content: space-between;
`;

export const Quality = ({ bases, composition, sequences }) => (
    <div className="printable-quality">
        <StyledTitle>
            <strong>Quality Distribution at Read Positions</strong>
            <Button type="button" color="purple" icon="print" onClick={() => window.print()}>
                Print
            </Button>
        </StyledTitle>
        <Chart createChart={Bases} data={bases} />

        <h5>
            <strong>Nucleotide Composition at Read Positions</strong>
        </h5>
        <Chart createChart={Nucleotides} data={composition} />

        <h5>
            <strong>Read-wise Quality Occurrence</strong>
        </h5>
        <Chart createChart={Sequences} data={sequences} />
    </div>
);
