import React from "react";
import { connect } from "react-redux";
import { Table } from "../../../base";
import Issues from "./Issues";

export const OTUGeneral = ({ abbreviation, issues, isolates, name, version }) => (
    <div>
        {issues ? <Issues issues={issues} isolates={isolates} /> : null}

        <Table bordered>
            <tbody>
                <tr>
                    <th className="col-xs-4">Name</th>
                    <td className="col-xs-8">{name}</td>
                </tr>
                <tr>
                    <th>Abbreviation</th>
                    <td>{abbreviation}</td>
                </tr>
                <tr>
                    <th>Version</th>
                    <td>{version}</td>
                </tr>
            </tbody>
        </Table>
    </div>
);

export const mapStateToProps = state => {
    const { abbreviation, issues, isolates, name, version } = state.otus.detail;
    return {
        abbreviation,
        issues,
        isolates,
        name,
        version
    };
};

export default connect(mapStateToProps)(OTUGeneral);
