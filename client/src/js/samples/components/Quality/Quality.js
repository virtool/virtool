import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { Button } from "../../../base";
import LegacyAlert from "../LegacyAlert";
import Chart from "./Chart";
import Bases from "./Bases";
import Nucleotides from "./Nucleotides";
import Sequences from "./Sequences";

const QualityLegacyAlert = styled.div`
    margin-bottom: 20px;
`;

const SampleDetailQuality = props => (
    <React.Fragment>
        <QualityLegacyAlert>
            <LegacyAlert />
        </QualityLegacyAlert>

        <div className="printable-quality">
            <h5>
                <strong>Quality Distribution at Read Positions</strong>
                <Button
                    type="button"
                    bsStyle="info"
                    bsSize="xsmall"
                    icon="print"
                    onClick={() => window.print()}
                    pullRight
                >
                    Print
                </Button>
            </h5>
            <Chart createChart={Bases} data={props.bases} />

            <h5>
                <strong>Nucleotide Composition at Read Positions</strong>
            </h5>
            <Chart createChart={Nucleotides} data={props.composition} />

            <h5>
                <strong>Read-wise Quality Occurrence</strong>
            </h5>
            <Chart createChart={Sequences} data={props.sequences} />
        </div>
    </React.Fragment>
);

const mapStateToProps = state => {
    const { bases, composition, sequences } = state.samples.detail.quality;

    return {
        bases,
        composition,
        sequences
    };
};

export default connect(mapStateToProps)(SampleDetailQuality);
