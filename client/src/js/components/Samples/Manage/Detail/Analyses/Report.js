import React from "react";
import Numeral from "numeral";
import { upperFirst, camelCase } from "lodash-es";
import { Table } from "react-bootstrap";
import { Icon, Button, RelativeTime } from "virtool/js/components/Base";

import PathoscopeViewer from "./Pathoscope/Viewer";

const AnalysisReport = (props) => {

    let content;

    if (props.algorithm.indexOf("pathoscope") > -1) {
        content = (
            <PathoscopeViewer
                {...props}
            />
        );
    }

    /*
    if (props.algorithm === "nuvs") {
        content = (
            <NuVsViewer
                {...props}
            />
        )
    }
    */

    return (
        <div>
            <Table bordered>
                <tbody>
                    <tr>
                        <th className="col-md-3">Name</th>
                        <td className="col-md-9">{props.name || "Unnamed Analysis"}</td>
                    </tr>
                    <tr>
                        <th>Algorithm</th>
                        <td>{props.algorithm === "nuvs" ? "NuVs": upperFirst(camelCase(props.algorithm))}</td>
                    </tr>
                    <tr>
                        <th>Library Read Count</th>
                        <td>{Numeral(props.readCount).format()}</td>
                    </tr>
                    <tr>
                        <th>Added</th>
                        <td><RelativeTime time={props.timestamp} /></td>
                    </tr>
                    <tr>
                        <th>User</th>
                        <td>{props.username}</td>
                    </tr>
                </tbody>
            </Table>

            {content}

            <Button bsStyle="primary" onClick={props.onBack} block>
                <Icon name="arrow-back" /> Back
            </Button>
        </div>
    );
};

AnalysisReport.propTypes = {
    name: React.PropTypes.string,
    username: React.PropTypes.string,
    algorithm: React.PropTypes.string,
    timestamp: React.PropTypes.string,
    readCount: React.PropTypes.number,
    onBack: React.PropTypes.func
};

export default AnalysisReport;
