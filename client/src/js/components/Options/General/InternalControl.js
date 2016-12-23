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
import React from "react";
import Toggle from 'react-bootstrap-toggle';
import TypeAhead from 'react-bootstrap-typeahead';
import { Row, Col, Panel } from "react-bootstrap";
import { Flex, FlexItem, Input, Button, ListGroupItem } from "virtool/js/components/Base";

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
            <div>
                <Row>
                    <Col md={6}>
                        <Flex alignItems="center" style={{marginBottom: "10px"}}>
                            <FlexItem grow={1} >
                                <strong>Internal Control</strong>
                            </FlexItem>
                            <FlexItem grow={0} shrink={0}>
                                <Toggle
                                    on="ON"
                                    off="OFF"
                                    size="small"
                                    active={this.props.settings.get('use_internal_control')}
                                    onChange={this.toggle}
                                />
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={6} />
                </Row>
                <Row>
                    <Col md={6}>
                        <Panel>
                            <TypeAhead
                                options={options}
                                selected={this.state.selected}
                                onChange={this.handleChange}
                                disabled={!this.props.settings.get('use_internal_control')}
                            />
                        </Panel>
                    </Col>
                    <Col md={6}>
                        <Panel>
                            Set a virus that is spiked into samples to be used as a positive control. Viral abundances
                            in a sample can be calculated as proportions relative to the control.
                        </Panel>
                    </Col>
                </Row>
            </div>
        );
    }

});

module.exports = InternalControl;

