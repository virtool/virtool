/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusGeneral
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Table } from "react-bootstrap";

import { InputCell } from "virtool/js/components/Base";
import Issues from "./Issues";


/**
 * Displays general information about the virus whose detail is displayed. Also provided some InputCell components to
 * edit some of the mutable information for the virus: name, abbreviation.
 *
 * @class
 */
const VirusGeneral = (props) => {

    const uniqueIdRow = props.showIds ? (
        <tr>
            <th>Unique ID</th>
            <td>{props.virusId}</td>
        </tr>
    ): null;

    let issues;

    if (props.issues) {
        issues = <Issues issues={props.issues} isolates={props.isolates} />
    }

    return (
        <div>
            {issues}

            <Table bordered>
                <tbody>
                    <tr>
                        <th className="col-sm-4">Name</th>
                        <td className="col-sm-8">{props.name}</td>
                    </tr>
                    <tr>
                        <th>Abbreviation</th>
                        <td>{props.abbreviation}</td>
                    </tr>
                    <tr>
                        <th>Version</th>
                        <td>{props.version}</td>
                    </tr>
                    {uniqueIdRow}
                </tbody>
            </Table>
        </div>
    );
};

VirusGeneral.propTypes = {
    virusId: PropTypes.string.isRequired,
    version: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    abbreviation: PropTypes.string,
    canModify: PropTypes.bool,
    showIds: PropTypes.bool,
    issues: PropTypes.object,
    isolates: PropTypes.arrayOf(PropTypes.object),
    onSave: PropTypes.func
};

const mapStateToProps = (state) => {
    const detail = state.viruses.detail;

    return {
        showIds: state.account.settings.show_ids,
        canModify: state.account.permissions.modify_virus,
        virusId: detail.id,
        name: detail.name,
        abbreviation: detail.abbreviation,
        version: detail.version,
        issues: detail.issues,
        isolates: detail.isolates
    };
};

const mapDispatchToProps = () => {
    return {
        onSave: (key, value) => {
            window.console.log(key, value);
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusGeneral);

export default Container;
