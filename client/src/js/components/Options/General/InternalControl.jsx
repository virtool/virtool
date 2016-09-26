/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports InternalControl
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var TypeAhead = require('react-bootstrap-typeahead').default;
var Panel = require('react-bootstrap/lib/Panel');

var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Input = require('virtool/js/components/Base/Input.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var InternalControl = React.createClass({

    getInitialState: function () {
        return {
            // Set true when the input field has focus.
            focused: false,
            selected: this.getSelected()
        };
    },

    /**
     * Calculates the inputValue (virus name) from the virus id of the current control (controlId). Returns an empty
     * string if no controlId is defined.
     *
     * @func
     */
    getSelected: function () {
        // The id of the virus that is used as an internal control if there is one..
        var controlId = this.props.settings.get('internal_control_id');

        var virus;

        if (controlId) {
            virus = dispatcher.db.viruses.by("_id", controlId);
        }

        var selected = [];

        if (virus) {
            selected.push({
                label: virus.name,
                id: virus._id
            });
        }

        return selected;
    },

    componentDidMount: function () {
        this.props.settings.on('change', this.update);
        this.props.viruses.on('change', this.update);
    },

    componentWillUnmount: function () {
        this.props.settings.off('change', this.update);
        this.props.viruses.off('change', this.update);
    },

    /**
     * Toggles use of an internal control. Updates the 'use_internal_control' setting value. Triggered by a click event
     * on the 'enable this feature' button.
     *
     * @func
     */
    toggle: function () {
        this.props.settings.set('use_internal_control', !this.props.settings.get('use_internal_control'));
    },

    /**
     * Refreshes the component state from the dispatcher settings object. Triggered when the settings object emits an
     * update event.
     *
     * @func
     */
    update: function () {
        this.setState({selected: this.getSelected()});
    },

    /**
     * Handles a change in the text input field. The new value is used to filter the virus names that appear in the
     * dropdown menu.
     *
     * @param selected {object} - the new selection from TypeAhead
     * @func
     */
    handleChange: function (selected) {
        this.props.settings.set('internal_control_id', selected[0].id);
    },

    render: function () {

        var options = dispatcher.db.viruses.chain().find().simplesort('name').data().map(function (document) {
            return {
                label: document.name,
                id: document._id
            };
        }, this);

        return (
            <Panel>
                <div style={{marginBottom: "15px"}}>
                    <TypeAhead
                        options={options}
                        selected={this.state.selected}
                        onChange={this.handleChange}
                        disabled={!this.props.settings.get('use_internal_control')} />
                </div>

                <PushButton onClick={this.toggle} block>
                    <Checkbox checked={this.props.settings.get('use_internal_control')} /> Enable this feature
                </PushButton>
            </Panel>
        );
    }

});

module.exports = InternalControl;

