/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports DatabaseOptions
 */

'use strict';

var _ = require('lodash');
import React from "react";
var Panel = require('react-bootstrap/lib/Panel');

var InputSave = require('virtool/js/components/Base/InputSave');

/**
 * A form component for changing settings for connection to the VT MongoDB database.
 */
var DatabaseOptions = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return (
            this.props.settings.db_name != nextProps.settings.db_name ||
            this.props.settings.db_host != nextProps.settings.db_host ||
            this.props.settings.db_port != nextProps.settings.db_port
        );
    },

    handleSave: function (data) {
        dispatcher.settings.set(data.name, data.value);
    },

    render: function () {
        return (
            <Panel>
                <InputSave
                    label='Database Name'
                    name='db_name'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.db_name}
                />
                <InputSave
                    label='MongoDB Host'
                    name='db_host'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.db_host}
                />
                <InputSave
                    label='MongoDB Port'
                    name='db_port'
                    type='number'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.db_port}
                />
            </Panel>
        );
    }

});

module.exports = DatabaseOptions;
