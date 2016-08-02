/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports TaskField
 */

'use strict';

var _ = require('lodash');
var CX = require('classnames');
var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');


/**
 * A component centered around an input element that updates a task-specific setting on the server. Shows pending save
 * requests by disabling the input and showing a spinner.
 */
var TaskField = React.createClass({

    propTypes: {
        taskPrefix: React.PropTypes.string.isRequired,
        resource: React.PropTypes.string.isRequired
    },

    getInitialState: function () {
        return {
            value: this.getValue(),
            pending: false
        };
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return !_.isEqual(nextState, this.state);
    },

    componentDidMount: function () {
        this.props.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        this.props.settings.off('change', this.update);
    },

    /**
     * Get the value to populate the input element with from the settings object.
     *
     * @returns - the setting from the settings object associated with this component.
     */
    getValue: function () {
        return this.props.settings.data[this.props.taskPrefix + '_' + this.props.resource];
    },

    /**
     * Handles a blur event in the input element. If a save is not pending, set the field value to the value stored in
     * settings.
     *
     * @func
     */
    handleBlur: function () {
        if (!this.state.pending) this.setState({value: this.getValue()});
    },

    /**
     * Handle a change event from the input element. Sets state to match what was entered.
     *
     * @param event {object} - the change event.
     * @func
     */
    handleChange: function (event) {
        this.setState({value: event.target.value});
    },

    /**
     * Handle a submit event from the form element. First set state to show a pending save. Then send a setting update
     * to the server. Pass a callback to remove pending state when the transaction completes. Also remove the focus
     * from the saved input element.
     *
     * @param event {object} - the submit event.
     * @func
     */
    handleSubmit: function (event) {
        event.preventDefault();

        this.setState({pending: true}, function () {
            this.props.settings.set(
                this.props.taskPrefix + '_' + this.props.resource,
                this.state.value === '' ? 1: this.state.value
            ).success(this.onComplete).failure(this.onComplete);

            this.refs.input.blur();
        });
    },

    /**
     * Removes the pending state from the component. Called when the setting save transaction completes.
     *
     * @func
     */
    onComplete: function () {
        this.setState({pending: false});
    },

    /**
     * Updates the value from the settings object. Called on an update event from the settings object.
     */
    update: function () {
        this.setState({value: this.getValue()});
    },

    render: function () {

        // Apply the 'has-feedback' Bootstrap class to the input element if a setting save is pending.
        var groupClass = CX({
            'form-group': true,
            'has-feedback': this.state.pending || this.props.readOnly
        });

        var feedbackIcon;

        // If a settings save is pending show a spinner in the input element.
        if (this.state.pending || this.props.readOnly) {
            feedbackIcon = (
                <span className='form-control-feedback'>
                    <Icon name='lock' pending={this.state.pending} />
                </span>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className={groupClass}>
                    <input
                        ref='input'
                        type='number'
                        className='form-control'
                        value={this.state.value}
                        onBlur={this.handleBlur}
                        onChange={this.handleChange}
                        disabled={this.state.pending || this.props.readOnly}
                    />
                    {feedbackIcon}
                </div>
            </form>
        );
    }

});

module.exports = TaskField;