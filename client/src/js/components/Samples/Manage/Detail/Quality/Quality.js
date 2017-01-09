/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Quality
 */

import React from "react";
import { Panel } from "react-bootstrap";
import { Icon, Button } from "virtool/js/components/Base";

import Chart from "./Chart";
import Bases from "./Bases";
import Nucleotides from "./Nucleotides";
import Sequences from "./Sequences";

/**
 * A component that renders the three quality graphs associated with a sample given sample data.
 *
 * @class
 */
export default class SampleDetailQuality extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pending: false,
            download: null
        };
    }

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        quality: React.PropTypes.object.isRequired
    };

    pdf = () => {
        this.setState({pending: true, download: null}, () => {
            dispatcher.db.samples.request("quality_pdf", {_id: this.props._id})
                .success((data) => {
                    this.setState({
                        pending: false,
                        download: data.file_id
                    });
            });
        });
    };

    render = () => (
        <Panel className="tab-panel">
            <div className="printable-quality">
                <h5>
                    <strong>Quality Distribution at Read Positions</strong>
                    <Button
                        onClick={this.state.download ? null : this.pdf}
                        bsStyle={this.state.download ? "primary" : "default"}
                        href={this.state.download ? `download/${this.state.download}`: null}
                        download={this.state.download ? `quality_${this.props._id}.pdf`: null}
                        bsSize="xsmall"
                        pullRight
                    >
                        <Icon name="file-pdf" pending={this.state.pending} /> PDF
                    </Button>
                </h5>
                <Chart
                    createChart={Bases}
                    data={this.props.quality.bases}
                />

                <h5><strong>Nucleotide Composition at Read Positions</strong></h5>
                <Chart
                    createChart={Nucleotides}
                    data={this.props.quality.composition}
                />

                <h5><strong>Read-wise Quality Occurrence</strong></h5>
                <Chart
                    createChart={Sequences}
                    data={this.props.quality.sequences}
                />

            </div>
        </Panel>
    );
}
