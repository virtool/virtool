/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports OTUGeneral
 */

import React from "react";
import { connect } from "react-redux";
import { Table } from "react-bootstrap";
import { IDRow } from "../../../base";

import Issues from "./Issues";

const OTUGeneral = ({ abbreviation, id, issues, isolates, name, version }) => (
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
                <IDRow id={id} />
            </tbody>
        </Table>
    </div>
);

const mapStateToProps = state => ({
    ...state.otus.detail
});

export default connect(
    mapStateToProps,
    null
)(OTUGeneral);
