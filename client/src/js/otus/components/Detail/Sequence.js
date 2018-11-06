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
import { Table, Label, Collapse } from "react-bootstrap";
import { Icon, Flex, FlexItem, ListGroupItem } from "../../../base";
import { followDownload } from "../../../utils/utils";

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
        sequence: PropTypes.string,
        showEditSequence: PropTypes.func,
        showRemoveSequence: PropTypes.func,
        canModify: PropTypes.bool
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
        const id = this.props.id;

        let buttons;

        if (this.state.in) {
            buttons = (
                <FlexItem>
                    <Flex alignItem="center">
                        {this.props.canModify ? (
                            <FlexItem grow={0} shrink={0}>
                                <Icon
                                    name="pencil-alt"
                                    bsStyle="warning"
                                    tip="Edit Sequence"
                                    onClick={this.handleShowEditSequence}
                                />
                            </FlexItem>
                        ) : null}
                        {this.props.canModify ? (
                            <FlexItem grow={0} shrink={0} pad={3}>
                                <Icon
                                    name="trash"
                                    bsStyle="danger"
                                    tip="Remove Sequence"
                                    onClick={this.handleShowRemoveSequence}
                                />
                            </FlexItem>
                        ) : null}
                        <FlexItem grow={0} shrink={0} pad={3}>
                            <Icon name="download" tip="Download FASTA" onClick={this.handleDownload} />
                        </FlexItem>
                        <FlexItem pad={5}>
                            <button type="button" className="close" onClick={this.handleCloseClick}>
                                <span>×</span>
                            </button>
                        </FlexItem>
                    </Flex>
                </FlexItem>
            );
        }

        return (
            <ListGroupItem
                className="spaced"
                componentClass="div"
                key={id}
                onClick={this.state.in ? null : () => this.setState({ in: true })}
            >
                <div>
                    <Flex alignItems="center">
                        <FlexItem grow={0} shrink={0}>
                            <Label>{accession}</Label>
                        </FlexItem>
                        <FlexItem className="sequence-header-definition" grow={1} shrink={1} pad={5}>
                            {this.props.definition}
                        </FlexItem>
                        {buttons}
                    </Flex>
                </div>

                <Collapse in={this.state.in}>
                    <div>
                        <Table style={{ marginTop: "10px" }} bordered>
                            <tbody>
                                <tr>
                                    <th>Accession</th>
                                    <td>{accession}</td>
                                </tr>
                                <tr>
                                    <th>Host</th>
                                    <td>{this.props.host}</td>
                                </tr>
                                <tr>
                                    <th>Definition</th>
                                    <td>{this.props.definition}</td>
                                </tr>
                                <tr>
                                    <th>Sequence</th>
                                    <td className="sequence-cell">
                                        <textarea rows="5" value={this.props.sequence} readOnly />
                                    </td>
                                </tr>
                            </tbody>
                        </Table>
                    </div>
                </Collapse>
            </ListGroupItem>
        );
    }
}

export default Sequence;
