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
import { connect } from "react-redux";
import { Table } from "react-bootstrap";
import { Icon, InputCell } from "virtool/js/components/Base";

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
            <th>Database ID</th>
            <td>{props.virusId}</td>
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
                    <tr>
                        <th>Version</th>
                        <td>{props.version}</td>
                    </tr>
                    {databaseIdRow}
                </tbody>
            </Table>
        </div>
    )
};

VirusGeneral.propTypes = {
    virusId: React.PropTypes.string.isRequired,
    version: React.PropTypes.number.isRequired,
    name: React.PropTypes.string.isRequired,
    abbreviation: React.PropTypes.string,
    canModify: React.PropTypes.bool
};

const mapStateToProps = (state) => {
    const detail = state.viruses.detail;

    return {
        showIds: state.account.settings.show_ids,
        canModify: state.account.permissions.modify_virus,
        virusId: detail.virus_id,
        name: detail.name,
        abbreviation: detail.abbreviation,
        version: detail.version,
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onSave: (key, value) => {
            console.log(key, value);
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusGeneral);

export default Container;
