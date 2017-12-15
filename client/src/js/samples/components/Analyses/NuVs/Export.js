/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";
import PropTypes from "prop-types";
import { ButtonGroup, Modal, Table, Well } from "react-bootstrap";

import { followDynamicDownload } from "../../../../utils";
import { Button } from "../../../../base";

const getInitialState = () => {
    return {
        mode: "contigs",
        evalue: false,
        orfs: false,
        pos: false,
        family: false
    };
};

export default class NuVsExport extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        show: PropTypes.bool,
        sampleName: PropTypes.string,
        analysisId: PropTypes.string,
        results: PropTypes.array,
        onHide: PropTypes.func
    };

    handleExited = () => {
        this.setState(getInitialState());
    };

    handleSubmit = (event) => {
        event.preventDefault();

        if (this.state.mode === "contigs") {
            const content = this.props.results.map(result => {
                const orfNames = result.orfs.reduce((names, orf) => {
                    // Get the best hit for the current ORF.
                    if (orf.hits.length) {
                        const bestHit = orf.hits.reduce((best, hit) => {
                            if (hit.full_e < best.e) {
                                best.e = hit.full_e;
                                best.name = hit.names[0];
                            }

                            return best;
                        }, {name: null, e: 10});

                        if (bestHit.name) {
                            names.push(bestHit.name);
                        }
                    }

                    return names;
                }, []);

                return `>sequence_${result.index}|${this.props.sampleName}|${orfNames.join("|")}\n${result.sequence}`
            });

            return followDynamicDownload(
                `nuvs.${this.props.sampleName.replace(" ", "_")}.${this.props.analysisId}.contigs.fa`,
                content.join("\n")
            );
        }

        const sampleName = this.props.sampleName;

        const content = this.props.results.reduce((orfs, result) => {
            result.orfs.forEach(orf => {
                // Get the best hit for the current ORF.
                if (orf.hits.length) {
                    const bestHit = orf.hits.reduce((result, hit) => {
                        if (hit.full_e < result.e) {
                            result.e = hit.full_e;
                            result.name = hit.names[0];
                        }

                        return result;
                    }, {name: null, e: 10});

                    if (bestHit.name) {
                        orfs.push(
                            `>orf_${result.index}_${orf.index}|${sampleName}|${bestHit.name}\n${orf.pro}`
                        );
                    }
                }
            });

            return orfs;
        }, []);

        followDynamicDownload(
            `nuvs.${this.props.sampleName.replace(" ", "_")}.${this.props.analysisId}.orfs.fa`,
            content.join("\n")
        );


    };

    render () {
        let previewHeader = ">sequence_1|17SP002|RNA Polymerase";
        let previewSequence;
        let indexName;
        let indexExample;
        let barName;
        let barExample;

        if (this.state.mode === "contigs") {
            indexName = "sequence index";
            indexExample = "sequence_1";

            barName = "bar-separated ORF annotations";
            barExample = "RNA Polymerase|cg30";

            previewHeader += "|cg30";
            previewSequence = "CATTTTATCAATAACAATTAAAACAAACAAACAAAAAAACCTTACCAGCAGCAACAGCAAGATGGCCAAATAGGAACAGATAGGGAC";
        } else {
            indexName = "sequence index + orf index";
            indexExample = "orf_1_1";

            barName = "best annotation";
            barExample = "RNA Polymerase";

            previewHeader = previewHeader.replace("sequence_1", "orf_1_1");
            previewSequence = "ELREECRSLRSRCDQLEERVSAMEDEMNEMKREGKFREKRIKRNEQSLQEIWDYVKRPNLRLIGVPESDGENGTKLENTFREKSAME";
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Export NuVs Data
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <ButtonGroup style={{marginBottom: "15px"}} justified>
                            <ButtonGroup>
                                <Button
                                    type="button"
                                    active={this.state.mode === "contigs"}
                                    onClick={() => this.setState({...getInitialState(), mode: "contigs"})}
                                >
                                    Contigs
                                </Button>
                            </ButtonGroup>
                            <ButtonGroup>
                                <Button
                                    type="button"
                                    active={this.state.mode === "orfs"}
                                    onClick={() => this.setState({...getInitialState(), mode: "orfs"})}
                                >
                                    ORFs
                                </Button>
                            </ButtonGroup>
                        </ButtonGroup>

                        <label>Preview</label>
                        <Well className="text-muted">
                            <p style={{wordWrap: "break-word", marginBottom: 0}}>
                                <code>{previewHeader}</code>
                            </p>
                            <p style={{wordWrap: "break-word"}}>
                                <code>{previewSequence}&hellip;</code>
                            </p>
                        </Well>

                        <label>Header Fields</label>
                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Example</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{indexName}</td>
                                    <td><code>{indexExample}</code></td>
                                </tr>
                                <tr>
                                    <td>sample name</td>
                                    <td><code>17SP002</code></td>
                                </tr>
                                <tr>
                                    <td>{barName}</td>
                                    <td><code>{barExample}</code></td>
                                </tr>
                            </tbody>
                        </Table>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button type="submit" bsStyle="primary" icon="download">
                            Download
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
}
