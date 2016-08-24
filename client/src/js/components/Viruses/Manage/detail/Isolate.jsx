/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Isolate
 */

'use strict';

var CX = require('classnames');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Radio = require('virtool/js/components/Base/Radio.jsx');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var IsolateForm = require('./IsolateForm.jsx');
var IsolateHeader = require('./IsolateHeader.jsx');

/**
 * An isolate document that is a list item in a list of isolates. Displays the isolate name. Has icon buttons for editing
 * and removing the isolate and setting it as the default isolate for the virus. Can be selected by clicking, which
 * displays the sequences owned by the isolate in a neighbouring panel.
 *
 * @class
 */
var Isolate = React.createClass({

    propTypes: {
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string,
        sourceType: React.PropTypes.string,
        sourceName: React.PropTypes.string,
        default: React.PropTypes.bool,

        active: React.PropTypes.bool,
        allowedSourceTypes: React.PropTypes.array,
        restrictSourceTypes: React.PropTypes.bool,
        selectIsolate: React.PropTypes.func,
        canModify: React.PropTypes.bool
    },

    getInitialState: function () {
        return {
            // If no source type is available, 'unknown' will be used if restricted source types are enabled otherwise
            // an empty string will be used.
            sourceType: this.props.sourceType || (this.props.restrictSourceTypes ? 'unknown': ''),
            sourceName: this.props.sourceName || '',

            pendingRemoval: false,
            editing: false
        };
    },

    componentDidMount: function () {
        if (!this.props.isolateId) document.addEventListener("keyup", this.handleKeyUp, true);
    },

    componentWillReceiveProps: function (nextProps) {
        if (nextProps.sourceName !== this.props.sourceName || nextProps.sourceType !== this.props.sourceType) {
            this.setState({
                sourceType: nextProps.sourceType || (this.props.restrictSourceTypes ? 'unknown' : ''),
                sourceName: nextProps.sourceName || ''
            });
        }

        if (!this.props.isolateId && nextProps.isolateId) {
            this.componentWillUnmount();
        }
    },

    componentWillUnmount: function () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    },

    /**
     * Select the isolate as long as it is not disabled and not already the active isolate. The selection is handled by
     * the parent Isolates component.
     *
     * @param event {object} - The passed event used to prevent the default action.
     * @func
     */
    select: function (event) {
        event.preventDefault();
        if (!this.props.active) this.props.selectIsolate(this.props.isolateId);
    },

    /**
     * Handle a change from the isolate form. Updates state to reflect the current input values.
     *
     * @param changeObject {object} - an object of field values keyed by field names.
     * @func
     */
    handleChange: function (changeObject) {
        this.setState(changeObject);
    },

    /**
     * Called when the form is submitted or the saveIcon is clicked. If the sourceName or sourceType have changed, the
     * updated data is sent to the server. When a response is received, the form is closed. Saving with no change in the
     * data with simply close the form.
     *
     * @param event {object} - The passed event. Used for preventing the default action.
     * @func
     */
    save: function (event) {
        event.preventDefault();

        var adding = !this.props.isolateId;

        var hadChange = (
            this.state.sourceType !== this.props.sourceType ||
            this.state.sourceName !== this.props.sourceName
        );

        // Only send an update to the server if there has been a change in the sourceType or sourceName.
        if (hadChange) {
            // Set pendingChange so the component is disabled and a spinner icon is displayed.
            this.setState({pendingChange: true}, function () {
                // Construct a replacement isolate object and send it to the server.
                dispatcher.db.viruses.request('upsert_isolate', {
                    _id: this.props.virusId,
                    new: {
                        isolate_id: this.props.isolateId,
                        source_type: this.state.sourceType,
                        source_name: this.state.sourceName
                    }
                }).success(adding ? this.props.onAdd: this.toggleEditing);
            });
        }

        // If the data didn't change, just close the form and save sending it to the server.
        else {
            this.toggleEditing();
        }
    },

    /**
     * Remove the isolate as long as it's not disabled. The removal button is only shown if the isolate is the active
     * isolate, so this method can only successfully be called if props.active is true. The removal is handled by the
     * parent Isolate component.
     *
     * @param event {object} - The passed event used to prevent the default action.
     * @func
     */
    remove: function (event) {
        event.preventDefault();

        // First set state to indicate that the isolate is pending removal. Then, send a request to remove the
        // isolate.
        if (this.props.active) this.setState({pendingRemoval: true}, function () {
            dispatcher.db.viruses.request('remove_isolate', {
                _id: this.props.virusId,
                isolate_id: this.props.isolateId
            });
        });
    },

    /**
     * Set the isolate as the default isolate. This method can be called by any Isolate component, not just the active
     * one. Setting the default isolate is handled by the parent Isolate component, so the isolate_id must be passed up.
     *
     * @func
     */
    setAsDefault: function () {
        dispatcher.db.viruses.request('set_default_isolate', {
            _id: this.props.virusId,
            isolate_id: this.props.isolateId
        }, this.onSuccess);
    },

    /**
     * Toggles whether the isolate is being edited. Triggered by clicking the edit or cancel icon buttons.
     *
     * @func
     */
    toggleEditing: function () {
        var newState = _.assign(this.getInitialState(), {editing: !this.state.editing});

        if (this.state.editing) {
            this.setState(newState, function () {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        } else {
            this.setState(newState, function () {
                document.addEventListener("keyup", this.handleKeyUp, true);
            });
        }
    },

    handleKeyUp: function (event) {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.props.isolateId ? this.toggleEditing(): this.props.onAdd();
        }
    },

    render: function () {

        var adding = !this.props.isolateId;

        var icons;

        var isolateForm;

        // If the Isolate component is editing or adding an isolate document, show a form and special icon buttons for
        // saving an clearing changes.
        if (this.props.canModify) {
            if (adding || this.state.editing) {
                icons = (
                    <div className='icon-group'>
                        <Icon
                            name='floppy'
                            bsStyle='primary'
                            onClick={this.save}
                        />
                        <Icon
                            name='cancel-circle'
                            bsStyle='danger'
                            onClick={adding ? this.props.onAdd: this.toggleEditing}
                        />
                    </div>
                );

                isolateForm = (
                    <div style={{paddingTop: '10px'}}>
                        <IsolateForm
                            sourceType={this.state.sourceType}
                            sourceName={this.state.sourceName}
                            allowedSourceTypes={this.props.allowedSourceTypes}
                            restrictSourceTypes={this.props.restrictSourceTypes}
                            onChange={this.handleChange}
                            onSubmit={this.save}
                        />
                    </div>
                );
            } else {
                // Set icons to remove and edit the isolate document.
                var removeIcon = this.props.active ? (
                    <Icon
                        name='remove'
                        pending={this.state.pendingRemoval}
                        onClick={this.remove}
                        bsStyle='danger'
                    />
                ) : null;

                icons = (
                    <div className='icon-group'>
                        {this.props.active ?
                            <Icon name='pencil' onClick={this.toggleEditing} bsStyle='warning'/> : null}
                        {this.props.active && !this.state.pendingRemoval ? removeIcon : null}
                        {!this.state.pendingRemoval ?
                            <Radio onClick={this.setAsDefault} checked={this.props.default}/> : null}
                    </div>
                );
            }
        }

        var itemProps = {
            onClick: this.props.active ? null: this.select,
            disabled: this.state.pendingRemoval,
            allowFocus: this.props.active
        };

        // Classes to apply to the ListGroupItem.
        itemProps.className = CX({
            band: this.props.active,
            primary: adding,
            warning: this.state.editing && !adding
        });

        return (
            <ListGroupItem {...itemProps}>
                <IsolateHeader sourceType={this.state.sourceType} sourceName={this.state.sourceName}>
                    {icons}
                </IsolateHeader>
                {isolateForm}
            </ListGroupItem>
        );
    }
});

module.exports = Isolate;