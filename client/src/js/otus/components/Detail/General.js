import React from "react";
import { connect } from "react-redux";
import { Table } from "../../../base";
import Issues from "./Issues";

export const OTUGeneral = ({ abbreviation, issues, isolates, name, version }) => (
    <React.Fragment>
        {issues ? <Issues issues={issues} isolates={isolates} /> : null}

        <Table bordered>
            <tbody>
                <tr>
                    <th>Name</th>
                    <td>{name}</td>
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
    </React.Fragment>
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
