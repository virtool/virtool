/**
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";
import PropTypes from "prop-types";
import { filter, map, reduce, replace } from "lodash-es";
import { ButtonGroup, Modal } from "react-bootstrap";

import { followDynamicDownload } from "../../../utils/utils";
import { Button } from "../../../base/index";
import NuVsExportPreview from "./ExportPreview";

const getInitialState = () => ({
    mode: "contigs",
    evalue: false,
    orfs: false,
    pos: false,
    family: false
});

const getBestHit = items =>
    reduce(
        items,
        (best, hit) => {
            if (hit.full_e < best.e) {
                best.e = hit.full_e;
                best.name = hit.names[0];
            }

            return best;
        },
        { name: null, e: 10 }
    );

const downloadData = (analysisId, content, sampleName, suffix) =>
    followDynamicDownload(`nuvs.${replace(sampleName, " ", "_")}.${analysisId}.${suffix}.fa`, content.join("\n"));

export default class NuVsExport extends React.Component {
    constructor(props) {
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

    handleModalExited = () => {
        this.setState(getInitialState());
    };

    setMode = mode => {
        this.setState({ ...getInitialState(), mode });
    };

    handleSubmit = e => {
        e.preventDefault();

        if (this.state.mode === "contigs") {
            const content = map(this.props.results, result => {
                const orfNames = reduce(
                    result.orfs,
                    (names, orf) => {
                        // Get the best hit for the current ORF.
                        if (orf.hits.length) {
                            const bestHit = getBestHit(orf.hits);

                            if (bestHit.name) {
                                names.push(bestHit.name);
                            }
                        }

                        return names;
                    },
                    []
                );

                return `>sequence_${result.index}|${this.props.sampleName}|${orfNames.join("|")}\n${result.sequence}`;
            });

            return downloadData(this.props.analysisId, content, this.props.sampleName, "contigs");
        }

        const sampleName = this.props.sampleName;

        const content = map(this.props.results, (orfs, result) =>
            filter(result.orfs, orf => {
                // Get the best hit for the current ORF.
                if (orf.hits.length) {
                    const bestHit = getBestHit(orf.hits);

                    if (bestHit.name) {
                        return `>orf_${result.index}_${orf.index}|${sampleName}|${bestHit.name}\n${orf.pro}`;
                    }
                }
            })
        );

        downloadData(this.props.analysisId, content, this.props.sampleName, "orfs");
    };

    render() {
        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onExited={this.handleModalExited}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Export NuVs Data
                </Modal.Header>

                <form onSubmit={this.handleSubmit}>
                    <Modal.Body>
                        <ButtonGroup style={{ marginBottom: "15px" }} justified>
                            <ButtonGroup>
                                <Button
                                    type="button"
                                    active={this.state.mode === "contigs"}
                                    onClick={() => this.setMode("contigs")}
                                >
                                    Contigs
                                </Button>
                            </ButtonGroup>
                            <ButtonGroup>
                                <Button
                                    type="button"
                                    active={this.state.mode === "orfs"}
                                    onClick={() => this.setMode("orfs")}
                                >
                                    ORFs
                                </Button>
                            </ButtonGroup>
                        </ButtonGroup>

                        <NuVsExportPreview mode={this.state.mode} />
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
