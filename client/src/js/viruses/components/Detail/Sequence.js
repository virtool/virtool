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
import { Flex, FlexItem, ListGroupItem } from "virtool/js/components/Base";

class Sequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            in: false
        };
    }

    static propTypes = {
        accession: PropTypes.string,
        definition: PropTypes.string,
        host: PropTypes.string,
        sequence: PropTypes.string
    };

    render () {

        const accession = this.props.id;

        let closeButton;

        if (this.state.in) {
            closeButton = (
                <button type="button" className="close" onClick={() => this.setState({in: false})}>
                    <span>×</span>
                </button>
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
                        <FlexItem grow={0} shrin={0} pad={3}>
                            <Icon name="pencil" bsStyle="warning" tip="Edit Sequence" />
                        </FlexItem>
                        <FlexItem grow={0} shrin={0} pad={3}>
                            <Icon name="remove" bsStyle="danger" tip="Remove Sequence" />
                        </FlexItem>
                        <FlexItem grow={0} shrin={0} pad={3}>
                            <Icon name="remove" bsStyle="danger" tip="Remove Sequence" />
                        </FlexItem>
                        <FlexItem>
                            {closeButton}
                        </FlexItem>
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
