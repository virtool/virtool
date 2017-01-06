/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports InputCell
 *
 */

import React, { PropTypes } from "react";
import { Overlay, Popover } from "react-bootstrap";
import { Icon } from "./";

class InputCellField extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        value: PropTypes.any,
        onChange: PropTypes.func.isRequired,
        onLostFocus: PropTypes.func.isRequired,
        save: PropTypes.func.isRequired
    };

    componentDidMount () {
        // Move focus to the input field as soon as the component is mounted.
        this.inputNode.focus();
    }

    /**
     * Called when the input field value change. Calls the passed onChange function with the new value.
     *
     * @param event - the onChange event that triggered the callback.
     * @func
     */
    handleChange = (event) => {
        this.props.onChange(event.target.value);
    };

    /**
     * Calls the save method on the parent component.
     *
     * @param event - the submit event triggered on the form element.
     * @func
     */
    handleSubmit = (event) => {
        event.preventDefault();
        this.props.save();
    };

    render () {
        return (
            <form className="full-width" onSubmit={this.handleSubmit}>
                <input
                    ref={(node) => this.inputNode = node}
                    className="full-width"
                    value={this.props.value}
                    onChange={this.handleChange}
                    onBlur={this.props.onLostFocus}
                />
            </form>
        );
    }

}


function getInitialInputCellState (props) {
    return {
        // True when the cell is editable (not static)
        editing: false,

        // The value shown in the editable cell. Initially set to the static value.
        value: props.value,

        // Set to true when the mouse is hovering over the component.
        hoverCell: false,

        // Set to true when the save function has been called and onSuccess has not been called.
        pending: false,

        // Show an error popover indicating that the saved value is invalid.
        showError: false
    };
}


/**
 * A editable "tr" component. Editing is toggled with a pencil icon.
 *
 * @class
 */
export class InputCell extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialInputCellState(props);
    }

    static propTypes = {
        _id: PropTypes.string,
        field: PropTypes.string,
        value: PropTypes.string,
        collection: PropTypes.object
    };

    componentDidUpdate = (nextProps) => {
        if (nextProps.value !== this.props.value) {
            this.setState({pending: false}, () =>this.toggleEditing(null, false));
        }
    };

    /**
     * Function to be called when the input field loses focus (eg. from a click outside the field).
     */
    onLostInputFocus = () => {
        if (!this.state.hoverCell) {
            this.setState(getInitialInputCellState(this.props));
        }
    };

    /**
     * Function to be called when the cell is clicked in edit mode. Clears any error popovers.
     */
    onClick = () => {
        if (this.state.editing) {
            this.setState({showError: false});
        }
    };

    /**
     * Function to be called when the mouse enters the cell. Set hoverCell to true.
     */
    onMouseEnter = () => {
        this.setState({hoverCell: true});
    };

    /**
     * Function to be called when the mouse leaves the cell. Set hoverCell to false.
     */
    onMouseLeave = () => {
        this.setState({hoverCell: false});
    };

    /**
     * Function to be called when a change occurs in the input field. Passed  down to the InputField component. Sets
     * this.state.value to the passed value.
     *
     * @param value
     * @func
     */
    onChange = (value) => {
        this.setState({value: value});
    };

    /**
     * Toggle editing mode in the cell. Clears errors. Called when the pencil icon is clicked.
     *
     * @func
     */
    toggleEditing = (event, forceValue) => {
        this.setState({
            editing: forceValue === undefined ? !this.state.editing: forceValue,
            showError: false
        });
    };

    /**
     * Save the changes stored in this.value. Checks if the value is in fact changed and sends a change request to the
     * server. Finally, it sets state such that the cell returns to static mode.
     *
     * @func
     */
    save = () => {
        this.setState({pending: true}, () => {
            //
            if (this.state.value !== this.props.value) {
                this.props.collection.request("set_field", {
                    _id: this.props._id,
                    field: this.props.field,
                    value: this.state.value
                }).failure(() => {
                    this.setState({
                        showError: true,
                        editing: true,
                        pending: false
                    });
                });
            }

            // Save was clicked, but the value didn't change from the original static value. Toggle editing off but
            // don't send any data to the server.
            else {
                this.setState({pending: false}, () => this.toggleEditing(null, false));
            }
        });
    };

    /**
     * Dismiss any errors. Called as the error popover's 'onHide' function.
     */
    dismissError = () => {
        this.setState({showError: false});
    };

    render () {

        let content;

        if (this.state.editing) {
            // Show a loading spinner if the field is pending a save operation.
            if (this.state.pending) {
                content = (
                    <div className="input-cell-loading">
                        <Icon name="spinner" pending={true} />
                    </div>
                )
            }

            // Show an editable cell if in editing mode.
            else {
                // Only show a save icon if the field value has changed.
                let saveIcon;

                if (this.state.value !== this.props.value) {
                    saveIcon = <Icon name="floppy" bsStyle="primary" onClick={this.save} />;
                }

                const cellBoxProps = {
                    className: "input-cell-box focused",
                    onMouseEnter: this.onMouseEnter,
                    onMouseLeave: this.onMouseLeave
                };

                content = (
                    <div {...cellBoxProps}>
                        <InputCellField
                            className="full-width"
                            onLostFocus={this.onLostInputFocus}
                            onChange={this.onChange}
                            value={this.state.value}
                            save={this.save}
                        />

                        <div className="icon-group">
                            {saveIcon}
                            <Icon name="cancel-circle" bsStyle="danger" onClick={this.toggleEditing} />
                        </div>
                    </div>
                );
            }
        } else {
            // Show the cell content in static mode.
            content = (
                <div className="input-cell-box">
                    <div className="static-value">
                        {this.props.value}
                    </div>
                    <div className="icon-group">
                        <Icon name="pencil" bsStyle="warning" onClick={this.toggleEditing}/>
                    </div>
                </div>
            );
        }

        return (
            <td ref={this.cellNode} className="input-cell" onClick={this.onClick}>
                <Overlay target={this.cellNode} show={this.state.showError} onHide={this.dismissError} placement="top">
                    <Popover id="error-popover">
                        Entered {this.props.field} is already in use.
                    </Popover>
                </Overlay>
                {content}
            </td>
        );
    }
}
