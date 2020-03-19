import PropTypes from "prop-types";
import React from "react";
import { Collapse } from "react-bootstrap";
import { connect } from "react-redux";
import styled from "styled-components";
import { Badge, BoxGroupSection, Icon, Label, Table } from "../../../base";
import { followDownload } from "../../../utils/utils";
import { TargetInfo } from "./Target";

const SequenceCell = styled.td`
    padding: 0 !important;
    font-family: "Roboto Mono", monospace;

    > textarea {
        width: 100%;
        margin: 0 0 -4px 0;
        padding: 5px;
        border: none;
    }
`;

const SequenceHeader = styled.div`
    align-items: center;
    display: flex;

    > ${Label} {
        margin-right: 5px;
    }
`;

const SequenceHeaderButtons = styled.span`
    align-items: center;
    display: flex;
    margin-left: auto;

    button {
        margin-left: 2px;
    }

    i.fas {
        margin-right: 3px;
    }
`;

const SequenceTable = styled(Table)`
    margin-top: 10px;
    table-layout: fixed;
    th {
        width: 130px;
    }
`;

class Sequence extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            in: false
        };
    }

    static propTypes = {
        id: PropTypes.string,
        accession: PropTypes.string,
        definition: PropTypes.string,
        host: PropTypes.string,
        segment: PropTypes.string,
        sequence: PropTypes.string,
        showEditSequence: PropTypes.func,
        showRemoveSequence: PropTypes.func,
        canModify: PropTypes.bool,
        dataType: PropTypes.string,
        name: PropTypes.string,
        description: PropTypes.string,
        required: PropTypes.string,
        length: PropTypes.number
    };

    handleCloseClick = () => {
        this.setState({ in: false });
    };

    handleDownload = () => {
        followDownload(`/download/sequences/${this.props.id}`);
    };

    handleShowEditSequence = () => {
        this.props.showEditSequence(this.props.id);
    };

    handleShowRemoveSequence = () => {
        this.props.showRemoveSequence(this.props.id);
    };

    render() {
        const accession = this.props.accession;

        let buttons;

        if (this.state.in) {
            buttons = (
                <SequenceHeaderButtons>
                    {this.props.canModify ? (
                        <Icon
                            name="pencil-alt"
                            bsStyle="warning"
                            tip="Edit Sequence"
                            onClick={this.handleShowEditSequence}
                        />
                    ) : null}
                    {this.props.canModify ? (
                        <Icon
                            name="trash"
                            bsStyle="danger"
                            tip="Remove Sequence"
                            onClick={this.handleShowRemoveSequence}
                        />
                    ) : null}
                    <Icon name="download" tip="Download FASTA" onClick={this.handleDownload} />
                    <button type="button" className="close" onClick={this.handleCloseClick}>
                        <span>×</span>
                    </button>
                </SequenceHeaderButtons>
            );
        }

        const title = this.props.segment || this.props.definition;

        let segmentTargetRow;

        if (this.props.dataType === "barcode") {
            segmentTargetRow = (
                <tr>
                    <th>Target</th>
                    <td>
                        <TargetInfo {...this.props} />
                    </td>
                </tr>
            );
        } else {
            segmentTargetRow = (
                <tr>
                    <th>Segment</th>
                    <td>{this.props.segment}</td>
                </tr>
            );
        }

        return (
            <BoxGroupSection onClick={this.state.in ? null : () => this.setState({ in: true })}>
                <SequenceHeader>
                    <Label>{accession}</Label>
                    {title}
                    {buttons}
                </SequenceHeader>
                <Collapse in={this.state.in}>
                    <div>
                        <SequenceTable>
                            <tbody>
                                <tr>
                                    <th>Accession</th>
                                    <td>{accession}</td>
                                </tr>
                                <tr>
                                    <th>Definition</th>
                                    <td>{this.props.definition}</td>
                                </tr>
                                {segmentTargetRow}
                                <tr>
                                    <th>Host</th>
                                    <td>{this.props.host}</td>
                                </tr>

                                <tr>
                                    <th>
                                        Sequence <Badge>{this.props.sequence.length}</Badge>
                                    </th>
                                    <SequenceCell>
                                        <textarea rows="5" value={this.props.sequence} readOnly />
                                    </SequenceCell>
                                </tr>
                            </tbody>
                        </SequenceTable>
                    </div>
                </Collapse>
            </BoxGroupSection>
        );
    }
}

const mapStateToProps = state => ({
    dataType: state.references.detail.data_type,
    targets: state.references.detail.targets
});
export default connect(mapStateToProps)(Sequence);
