/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { Table, Label, Collapse } from "react-bootstrap";
import { Icon, Flex, FlexItem, ListGroupItem } from "virtool/js/components/Base";
import { followDownload } from "virtool/js/utils";

class Sequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            in: false
        };
    }

    static propTypes = {
        id: PropTypes.string,
        definition: PropTypes.string,
        host: PropTypes.string,
        sequence: PropTypes.string
    };

    render () {

        const accession = this.props.id;

        let buttons;

        if (this.state.in) {
            buttons = (
                <FlexItem>
                    <Flex alignItem="center">
                        <FlexItem grow={0} shrink={0}>
                            <Icon
                                name="pencil"
                                bsStyle="warning"
                                tip="Edit Sequence"
                                onClick={() => console.log("EDIT")}
                            />
                        </FlexItem>
                        <FlexItem grow={0} shrink={0} pad={3}>
                            <Icon
                                name="remove"
                                bsStyle="danger"
                                tip="Remove Sequence"
                                onClick={() => console.log("REMOVE")}
                            />
                        </FlexItem>
                        <FlexItem grow={0} shrink={0} pad={3}>
                            <Icon
                                name="download"
                                tip="Download FASTA"
                                onClick={() => followDownload(`/download/sequences/${this.props.id}`)}
                            />
                        </FlexItem>
                        <FlexItem pad={5}>
                            <button type="button" className="close" onClick={() => this.setState({in: false})}>
                                <span>×</span>
                            </button>
                        </FlexItem>
                    </Flex>
                </FlexItem>
            );
        }

        return (
            <ListGroupItem
                componentClass="div"
                key={accession}
                onClick={this.state.in ? null: () => this.setState({in: true})}
            >
                <div>
                    <Flex alignItems="center">
                        <FlexItem grow={0} shrink={0}>
                            <Label>{accession}</Label>
                        </FlexItem>
                        <FlexItem grow={1} shrink={0} pad={5}>
                            {this.props.definition}
                        </FlexItem>
                        {buttons}
                    </Flex>
                </div>

                <Collapse in={this.state.in}>
                    <div>
                        <Table style={{marginTop: "10px"}} bordered>
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
                                        <textarea
                                            rows="5"
                                            value={this.props.sequence}
                                            readOnly
                                        />
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
