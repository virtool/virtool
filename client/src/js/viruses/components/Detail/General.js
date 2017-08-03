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

/**
 * Displays general information about the virus whose detail is displayed. Also provided some InputCell components to
 * edit some of the mutable information for the virus: name, abbreviation.
 *
 * @class
 */
const VirusGeneral = (props) => {

    let nameCell;
    let abbrCell;

    if (props.canModify) {
        nameCell = (
            <InputCell
                className="col-sm-8"
                field="name"
                value={props.name}
                onSave={props.onSave}
            />
        );

        abbrCell = (
            <InputCell
                field="abbreviation"
                value={props.abbreviation}
                onSave={props.onSave}
            />
        );
    } else {
        nameCell = <td className="col-sm-8">{props.name}</td>;
        abbrCell = <td>{props.abbreviation}</td>;
    }

    const databaseIdRow = props.showIds ? (
        <tr>
            <th>Unique ID</th>
            <td>{props.virusId}</td>
        </tr>
    ): null;

    return (
        <Table bordered>
            <tbody>
                <tr>
                    <th className="col-sm-4">Name</th>
                    {nameCell}
                </tr>
                <tr>
                    <th>Abbreviation</th>
                    {abbrCell}
                </tr>
                <tr>
                    <th>Version</th>
                    <td>{props.version}</td>
                </tr>
                {databaseIdRow}
            </tbody>
        </Table>
    );
};

VirusGeneral.propTypes = {
    virusId: PropTypes.string.isRequired,
    version: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    abbreviation: PropTypes.string,
    canModify: PropTypes.bool,
    showIds: PropTypes.bool,

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
