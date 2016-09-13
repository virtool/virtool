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
var Panel = require('react-bootstrap/lib/Panel');
var Input = require('react-bootstrap/lib/InputGroup');
var Dropdown = require('react-bootstrap/lib/Dropdown');
var MenuItem = require('react-bootstrap/lib/MenuItem');
var DropdownMenu = require('react-bootstrap/lib/DropdownMenu');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A form component for setting whether an internal control should be used and which virus to use as a control.
 */
var InternalControl = React.createClass({

    getInitialState: function () {
        return {
            // The value to show in the input field.
            inputValue: this.getInputValue(),

            // Set true when the input field has focus.
            focused: false,

            // Set true when the dropdown menu should be visible.
            open: false
        };
    },

    componentDidMount: function () {
        this.props.settings.on('change', this.update);
        this.props.viruses.on('change', this.update);
    },

    componentWillUnmount: function () {
        this.props.settings.off('change', this.update);
        this.props.viruses.off('change', this.update);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state !== nextState;
    },

    /**
     * Calculates the inputValue (virus name) from the virus id of the current control (controlId). Returns an empty
     * string if no controlId is defined.
     *
     * @func
     */
    getInputValue: function () {
        // The id of the virus that is used as an internal control if there is one..
        var controlId = this.props.settings.get('internal_control_id');
        var virus = this.props.viruses.by("_id", controlId);

        // If an internal control is being used and exists, return its name.
        return controlId && virus ? virus.name : '';
    },

    /**
     * Triggered by a focus event on the input field. Allows the dropdown to be opened.
     *
     * @func
     */
    handleFocus: function () {
        this.setState({focused: true});
    },

    /**
     * Triggered by a blur event on the input field. Prevents the dropdown from being opened.
     *
     * @func
     */
    handleBlur: function () {
        this.setState({focused: false});
    },

    /**
     * Triggered when the dropdown wants to toggle its visibility. Only change the visibility based on the focus state
     * of the input field. Set state.open as true when the input is focused, otherwise set it as false.
     *
     * @func
     */
    handleToggle: function () {
        this.setState({open: this.state.focused});
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
     * Sets the virus_id to use as an internal control. Triggered by selecting a virus in the text input dropdown list.
     *
     * @param virus_id {string} - the virus_id to set as the internal control.
     * @func
     */
    select: function (virus_id) {
        this.props.settings.set('internal_control_id', virus_id);
    },

    /**
     * Refreshes the component state from the dispatcher settings object. Triggered when the settings object emits an
     * update event.
     *
     * @func
     */
    update: function () {
        this.setState({inputValue: this.getInputValue()});
    },

    /**
     * Handles a change in the text input field. The new value is used to filter the virus names that appear in the
     * dropdown menu.
     *
     * @param event {object} - the change event.
     * @func
     */
    handleChange: function (event) {
        this.setState({inputValue: event.target.value});
    },

    render: function () {

        var menuItemComponents;

        if (this.props.settings.get('use_internal_control')) {

            var predicate = this.state.inputValue ? {"name": {"$regex": ["^" + this.state.inputValue, "i"]}}: {};

            var options = _.sortBy(dispatcher.db.viruses.find(predicate), 'name').slice(0, 10);

            menuItemComponents = options.map(function (document) {
                var callback = function (event) {
                    event.preventDefault();
                    this.select(document._id);
                }.bind(this);

                return (
                    <MenuItem key={document._id} value={document._id} onClick={callback}>
                        {document.name}
                    </MenuItem>
                );
            }, this);
        }

        // Define a basic text Input component that when changed will narrow the dropdown list of virus names.
        var input = (
            <Input
                bsRole='toggle'
                type='text'
                value={this.state.inputValue}
                onChange={this.handleChange}
                onFocus={this.handleFocus}
                onBlur={this.handleBlur}
                disabled={!this.props.settings.get('use_internal_control')}
                spellCheck={false}
                autoComplete="off"
            />
        );

        // If an internal control is being used, wrap the Input component in a Dropdown component that shows a list of
        // virus names to choose as an internal control.
        if (this.props.settings.get('use_internal_control')) {
            var dropdownStyle = {
                width: "100%",
                marginTop: '-15px'
            };

            input = (
                <Dropdown id='internal-control-dropdown' onToggle={this.handleToggle} open={this.state.open} block vertical>
                    {input}
                    <DropdownMenu role='menu' style={dropdownStyle}>
                        {menuItemComponents}
                    </DropdownMenu>
                </Dropdown>
            );
        }

        return (
            <Panel>
                <form onSubmit={this.add}>
                    {input}
                </form>

                <PushButton onClick={this.toggle} block>
                    <Checkbox checked={this.props.settings.get('use_internal_control')} /> Enable this feature
                </PushButton>
            </Panel>
        );
    }

});

module.exports = InternalControl;

