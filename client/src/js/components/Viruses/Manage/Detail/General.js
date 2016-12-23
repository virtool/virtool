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

'use strict';

import React from "react";
var Table = require('react-bootstrap/lib/Table');

var Icon = require('virtool/js/components/Base/Icon');
var InputCell = require('virtool/js/components/Base/InputCell');

/**
 * Displays general information about the virus whose detail is displayed. Also provided some InputCell components to
 * edit some of the mutable information for the virus: name, abbreviation.
 *
 * @class
 */
var VirusGeneral = React.createClass({

    render: function () {

        var data = {_id: this.props._id};

        var nameCell;
        var abbrCell;

        if (this.props.canModify) {
            var collection = dispatcher.db.viruses;

            nameCell = (
                <InputCell
                    className='col-sm-8'
                    collection={collection}
                    _id={data._id}
                    field='name'
                    value={this.props.name}
                />
            );

            abbrCell = (
                <InputCell
                    collection={collection}
                    _id={data._id}
                    field='abbreviation'
                    value={this.props.abbreviation}

                />
            );
        } else {
            nameCell = <td className='col-sm-8'>{this.props.name}</td>;
            abbrCell = <td>{this.props.abbreviation}</td>;
        }
        
        var databaseIdRow = dispatcher.user.settings.show_ids ? (
            <tr>
                <th>Database ID</th>
                <td>{data._id}</td>
            </tr>
        ): null;

        var databaseVersionRow = dispatcher.user.settings.show_versions ? (
            <tr>
                <th>Database Version</th>
                <td>{this.props._version}</td>
            </tr>
        ): null;

        return (
            <div>
                <h5>
                    <Icon name='file' /> <strong>General Information</strong>
                </h5>
                <Table bordered>
                    <tbody>
                        <tr>
                            <th className='col-sm-4'>Name</th>
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
    }
});

module.exports = VirusGeneral;