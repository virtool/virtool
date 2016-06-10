/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PathOptions
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');

var InputSave = require('virtool/js/components/Base/InputSave.jsx');

/**
 * A set of InputSave components for updating data and watch path settings.
 */
var PathOptions = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return (
            this.props.settings.data_path != nextProps.settings.data_path ||
            this.props.settings.watch_path != nextProps.settings.watch_path
        )
    },

    handleSave: function (data) {
        dispatcher.settings.set(data.name, data.value);
    },

    render: function () {
        return (
            <Panel>
                <InputSave
                    label='Virtool Data'
                    name='watch_path'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.data_path}
                />
                <InputSave
                    label='Watch Folder'
                    name='watch_path'
                    onSave={this.handleSave}
                    initialValue={this.props.settings.watch_path}
                />
            </Panel>
        );
    }

});

module.exports = PathOptions;
