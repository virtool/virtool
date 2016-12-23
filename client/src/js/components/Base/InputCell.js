/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports InputCell
 */

'use strict';

import React from "react";
import ReactDOM from "react-dom";
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');

var Icon = require('./Icon');

var InputCellField = React.createClass({

    propTypes: {
        onChange: React.PropTypes.func.isRequired,
        onLostFocus: React.PropTypes.func.isRequired
    },

    componentDidMount: function () {
        // Move focus to the input field as soon as the component is mounted.
        ReactDOM.findDOMNode(this.refs.input).focus();
    },

    /**
     * Called when the input field value change. Calls the passed onChange function with the new value.
     *
     * @param event - the onChange event that triggered the callback.
     * @func
     */
    handleChange: function (event) {
        this.props.onChange(event.target.value);
    },

    /**
     * Calls the save method on the parent component.
     *
     * @param event - the submit event triggered on the form element.
     * @func
     */
    handleSubmit: function (event) {
        event.preventDefault();
        this.props.save();
    },

    render: function () {
        var inputProps = {
            className: 'full-width',
            ref: 'input',
            value: this.props.value,
            onChange: this.handleChange,
            onBlur: this.props.onLostFocus
        };

        return (
            <form className='full-width' onSubmit={this.handleSubmit}>
                <input {...inputProps} />
            </form>
        );
    }
});

/**
 * A editable 'tr' component. Editing is toggled with a pencil icon.
 *
 * @class
 */
var InputCell = React.createClass({

    propTypes: {
        field: React.PropTypes.string,
        value: React.PropTypes.string,
        collection: React.PropTypes.object
    },

    getInitialState: function () {
        return {
            // True when the cell is editable (not static)
            editing: false,

            // The value shown in the editable cell. Initially set to the static value.
            value: this.props.value,

            // Set to true when the mouse is hovering over the component.
            hoverCell: false,

            // Set to true when the save function has been called and onSuccess has not been called.
            pending: false,

            // Show an error popover indicating that the saved value is invalid.
            showError: false
        };
    },

    componentDidUpdate: function (nextProps) {
        if (nextProps.value !== this.props.value) {
            this.setState({pending: false}, function () {
                this.toggleEditing(null, false);
            });
        }
    },

    /**
     * Function to be called when the input field loses focus (eg. from a click outside the field).
     */
    onLostInputFocus: function () {
        if (!this.state.hoverCell) this.replaceState(this.getInitialState());
    },

    /**
     * Function to be called when the cell is clicked in edit mode. Clears any error popovers.
     */
    onClick: function () {
        if (this.state.editing) this.setState({showError: false});
    },

    /**
     * Function to be called when the mouse enters the cell. Set hoverCell to true.
     */
    onMouseEnter: function () {
        this.setState({hoverCell: true});
    },

    /**
     * Function to be called when the mouse leaves the cell. Set hoverCell to false.
     */
    onMouseLeave: function () {
        this.setState({hoverCell: false});
    },

    /**
     * Function to be called when a change occurs in the input field. Passed  down to the InputField component. Sets
     * this.state.value to the passed value.
     *
     * @param value
     * @func
     */
    onChange: function (value) {
        this.setState({value: value});
    },

    /**
     * Toggle editing mode in the cell. Clears errors. Called when the pencil icon is clicked.
     *
     * @func
     */
    toggleEditing: function (event, forceValue) {
        this.setState({
            editing: forceValue === undefined ? !this.state.editing: forceValue,
            showError: false
        });
    },

    /**
     * Save the changes stored in this.value. Checks if the value is in fact changed and sends a change request to the
     * server. Finally, it sets state such that the cell returns to static mode.
     *
     * @func
     */
    save: function () {
        this.setState({pending: true}, function () {
            //
            if (this.state.value !== this.props.value) {
                this.props.collection.request('set_field', {
                    _id: this.props._id,
                    field: this.props.field,
                    value: this.state.value
                }).failure(function () {
                    this.setState({
                        showError: true,
                        editing: true,
                        pending: false
                    });
                }, this);
            }

            // Save was clicked, but the value didn't change from the original static value. Toggle editing off but don't
            // send any data to the server.
            else {
                this.setState({pending: false}, function () {
                    this.toggleEditing(null, false);
                });
            }
        });
    },

    /**
     * Dismiss any errors. Called as the error popover's 'onHide' function.
     */
    dismissError: function () {
        this.setState({showError: false});
    },

    /**
     * Return the cell DOM node. Used for attached the error popover overlay to the DOM.
     */
    getCellNode: function () {
        return ReactDOM.findDOMNode(this.refs.cell);
    },

    render: function () {

        var content;

        if (this.state.editing) {
            // Show a loading spinner if the field is pending a save operation.
            if (this.state.pending) {
                content = (
                    <div className='input-cell-loading'>
                        <Icon name='spinner' pending={true} />
                    </div>
                )
            }

            // Show an editable cell if in editing mode.
            else {
                // Only show a save icon if the field value has changed.
                var saveIcon;

                if (this.state.value !== this.props.value) {
                    saveIcon = <Icon name='floppy' bsStyle='primary' onClick={this.save} />;
                }

                var cellBoxProps = {
                    className: 'input-cell-box focused',
                    onMouseEnter: this.onMouseEnter,
                    onMouseLeave: this.onMouseLeave
                };

                content = (
                    <div {...cellBoxProps}>
                        <InputCellField
                            className='full-width'
                            onLostFocus={this.onLostInputFocus}
                            onChange={this.onChange}
                            value={this.state.value}
                            save={this.save}
                        />

                        <div className='icon-group'>
                            {saveIcon}
                            <Icon name='cancel-circle' bsStyle='danger' onClick={this.toggleEditing} />
                        </div>
                    </div>
                );
            }
        } else {
            // Show the cell content in static mode.
            content = (
                <div className='input-cell-box'>
                    <div className='static-value'>
                        {this.props.value}
                    </div>
                    <div className='icon-group'>
                        <Icon name='pencil' bsStyle='warning' onClick={this.toggleEditing}/>
                    </div>
                </div>
            );
        }

        return (
            <td ref='cell' className='input-cell' onClick={this.onClick}>
                <Overlay target={this.getCellNode} show={this.state.showError} onHide={this.dismissError} placement='top'>
                    <Popover id='error-popover'>
                        Entered {this.props.field} is already in use.
                    </Popover>
                </Overlay>
                {content}
            </td>
        );
    }

});

module.exports = InputCell;
