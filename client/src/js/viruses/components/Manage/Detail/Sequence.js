/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { Table, Label, Collapse } from "react-bootstrap";
import { Icon, ListGroupItem, Input } from "virtool/js/components/Base";

class Sequence extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            in: false
        };
    }

    render () {

        const accession = this.props.accession;

        return (
            <ListGroupItem componentClass="div" key={accession} onClick={this.state.in ? null: () => this.setState({in: true})}>
                <div>
                    <Label>{accession}</Label> {this.props.definition}
                    <Icon
                        name="caret-right"
                        onClick={() => this.setState({in: false})}
                        pullRight
                    />
                </div>

                <Collapse in={this.state.in}>
                    <div>
                        <Table style={{marginTop: "10px"}} condensed bordered>
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
