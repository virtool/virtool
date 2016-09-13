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
var Collapse = require('react-bootstrap/lib/Collapse');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Radio = require('virtool/js/components/Base/Radio.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
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

        active: React.PropTypes.bool,
        allowedSourceTypes: React.PropTypes.array,
        restrictSourceTypes: React.PropTypes.bool,

        toggleAdding: React.PropTypes.func
    },

    getInitialState: function () {
        return {
            // If no source type is available, 'unknown' will be used if restricted source types are enabled otherwise
            // an empty string will be used.
            sourceType: this.props.restrictSourceTypes ? 'unknown': '',
            sourceName: '',

            collapsed: true,
            pending: false
        };
    },

    componentWillReceiveProps: function (nextProps) {
        if (!this.props.active && nextProps.active) {
            document.addEventListener("keyup", this.handleKeyUp, true);
        }

        if (this.props.active && !nextProps.active) {
            this.setState(this.getInitialState(), function () {
                document.removeEventListener("keyup", this.handleKeyUp, true);
            });
        }
    },

    componentWillUnmount: function () {
        document.removeEventListener("keyup", this.handleKeyUp, true);
    },

    handleEntered: function () {
        this.setState({
            collapsed: false
        });
    },

    handleExited: function () {
        this.setState({
            collapsed: true
        });
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

        // Set pendingChange so the component is disabled and a spinner icon is displayed.
        this.setState({pending: true}, function () {
            // Construct a replacement isolate object and send it to the server.
            dispatcher.db.viruses.request('upsert_isolate', {
                _id: this.props.virusId,
                new: {
                    isolate_id: this.props.isolateId,
                    source_type: this.state.sourceType,
                    source_name: this.state.sourceName
                }
            }).success(this.props.toggleAdding);
        });
    },

    handleKeyUp: function (event) {
        if (event.keyCode === 27) {
            event.stopImmediatePropagation();
            this.props.toggleAdding();
        }
    },

    render: function () {

        var buttons;

        if (this.props.active) {
            buttons = (
                <Flex justifyContent="flex-end">
                    <Flex.Item>
                        <PushButton onClick={this.props.toggleAdding}>
                            Cancel
                        </PushButton>
                    </Flex.Item>
                    <Flex.Item pad>
                        <PushButton bsStyle="primary" onClick={this.save}>
                            <Icon name="floppy" /> Save
                        </PushButton>
                    </Flex.Item>
                </Flex>
            );
        }

        var itemProps = {
            style: {
                background: this.props.active ? "#dbe9f5": null,
                transition: '0.7s background'
            },

            allowFocus: this.props.active,

            onClick: this.state.collapsed ? this.props.toggleAdding: null,
            onEntered: this.handleEntered,
            onExited: this.handleExited
        };

        return (
            <ListGroupItem {...itemProps}>
                <Collapse in={!this.props.active}>
                    <div className='text-center'>
                        <Icon name='plus-square' bsStyle='primary'/> Add Isolate
                    </div>
                </Collapse>
                <Collapse in={this.props.active} onExited={this.handleExited} onEntered={this.handleEntered}>
                    <div>
                        <div style={{height: '15px'}} />
                        <IsolateForm
                            sourceType={this.state.sourceType}
                            sourceName={this.state.sourceName}
                            allowedSourceTypes={this.props.allowedSourceTypes}
                            restrictSourceTypes={this.props.restrictSourceTypes}
                            onChange={this.handleChange}
                            onSubmit={this.save}
                        />
                        {buttons}
                    </div>
                </Collapse>
            </ListGroupItem>
        );
    }
});

module.exports = Isolate;