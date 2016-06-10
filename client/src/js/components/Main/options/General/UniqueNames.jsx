/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UniqueNames
 */

'use strict';

var _ = require('lodash');
var CX = require('classnames');
var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/Input');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
var UniqueNames = React.createClass({

    getInitialState: function () {
        return {
            enabled: dispatcher.settings.get('sample_unique_names')
        };
    },

    componentDidMount: function () {
        dispatcher.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.settings.off('change', this.update);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state.enabled !== nextState.enabled;
    },

    /**
     * Updates the sourceTypes and enabled state when the settings object emits and update event.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    /**
     * Adds a source type to the list of allowed source types, resulting in a settings update being sent to the server.
     * Triggered by a click on the add button.
     *
     * @param event {object} - the click event.
     * @func
     */
    toggle: function (event) {
        event.preventDefault();
        dispatcher.settings.set('sample_unique_names', !this.state.enabled);
    },

    render: function () {
        return (
            <Panel>
                <PushButton onClick={this.toggle} block>
                    <Checkbox checked={this.state.enabled} /> Enable this feature
                </PushButton>
            </Panel>
        );
    }

});

module.exports = UniqueNames;

