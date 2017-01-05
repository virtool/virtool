import React from "react";
import { includes, upperFirst, camelCase } from "lodash";
import Numeral from "numeral";
import { Table } from "react-bootstrap";
import { Icon, Button, RelativeTime } from "virtool/js/components/Base";

import PathoscopeViewer from "./Pathoscope/Viewer";
import NuVsViewer from "./NuVs/Viewer";

export default class AnalysisReport extends React.Component {

    static propTypes = {
        name: React.PropTypes.string,
        algorithm: React.PropTypes.string,
        timestamp: React.PropTypes.string,
        username: React.PropTypes.string,
        readCount: React.PropTypes.number,
        onBack: React.PropTypes.func,
    };

    render () {

        let content;
        
        if (includes(this.props.algorithm, "pathoscope")) {
            content = (
                <PathoscopeViewer
                    {...this.props}
                />
            );
        }

        if (this.props.algorithm === "nuvs") {
            content = (
                <NuVsViewer
                    {...this.props}
                />
            )
        }

        return (
            <div>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className="col-md-3">Nickname</th>
                            <td className="col-md-9">{this.props.name || "Unnamed Analysis"}</td>
                        </tr>
                        <tr>
                            <th>Algorithm</th>
                            <td>
                                {this.props.algorithm === "nuvs" ? "NuVs": upperFirst(camelCase(this.props.algorithm))}
                            </td>
                        </tr>
                        <tr>
                            <th>Library Read Count</th>
                            <td>{Numeral(this.props.readCount).format()}</td>
                        </tr>
                        <tr>
                            <th>Added</th>
                            <td><RelativeTime time={this.props.timestamp} /></td>
                        </tr>
                        <tr>
                            <th>User</th>
                            <td>{this.props.username}</td>
                        </tr>
                    </tbody>
                </Table>

                {content}

                <Button bsStyle="primary" onClick={this.props.onBack} block>
                    <Icon name="arrow-back" /> Back
                </Button>
            </div>
        );
    }
}
