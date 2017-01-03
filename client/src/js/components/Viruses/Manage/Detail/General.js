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


import React from "react";
import { Table } from "react-bootstrap";
import { Icon, InputCell } from "virtool/js/components/Base";

/**
 * Displays general information about the virus whose detail is displayed. Also provided some InputCell components to
 * edit some of the mutable information for the virus: name, abbreviation.
 *
 * @class
 */
const VirusGeneral = (props) => {

    const data = {
        _id: props._id
    };

    let nameCell;
    let abbrCell;

    if (this.props.canModify) {
        nameCell = (
            <InputCell
                className="col-sm-8"
                collection={dispatcher.db.viruses}
                _id={data._id}
                field="name"
                value={props.name}
            />
        );

        abbrCell = (
            <InputCell
                collection={dispatcher.db.viruses}
                _id={data._id}
                field="abbreviation"
                value={props.abbreviation}

            />
        );
    } else {
        nameCell = <td className="col-sm-8">{props.name}</td>;
        abbrCell = <td>{props.abbreviation}</td>;
    }

    const databaseIdRow = dispatcher.user.settings.show_ids ? (
        <tr>
            <th>Database ID</th>
            <td>{data._id}</td>
        </tr>
    ): null;

    const databaseVersionRow = dispatcher.user.settings.show_versions ? (
        <tr>
            <th>Database Version</th>
            <td>{this.props._version}</td>
        </tr>
    ): null;

    return (
        <div>
            <h5>
                <Icon name="file" /> <strong>General Information</strong>
            </h5>
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
                    {databaseIdRow}
                    {databaseVersionRow}
                </tbody>
            </Table>
        </div>
    )
};

VirusGeneral.propTypes = {
    _id: React.PropTypes.string.isRequired,
    name: React.PropTypes.string.isRequired,
    abbreviation: React.PropTypes.string
};

export default VirusGeneral;
