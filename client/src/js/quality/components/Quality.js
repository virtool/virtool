import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { Button } from "../../base";
import LegacyAlert from "../../samples/components/LegacyAlert";
import Chart from "./Chart";
import Bases from "./Bases";
import Nucleotides from "./Nucleotides";
import Sequences from "./Sequences";

export const Quality = ({ bases, composition, sequences }) => (
    <div className="printable-quality">
        <h5>
            <strong>Quality Distribution at Read Positions</strong>
            <Button type="button" bsStyle="info" bsSize="xsmall" icon="print" onClick={() => window.print()} pullRight>
                Print
            </Button>
        </h5>
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
