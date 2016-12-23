/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IsolateForm
 */

'use strict';

import React from "react";
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Input = require('virtool/js/components/Base/Input');
var Icon = require('virtool/js/components/Base/Icon');

/**
 * A form component used to edit and add isolates.
 *
 * @class
 */
var IsolateForm = React.createClass({

    propTypes: {
        // These props inform initial state. If the form was mounted in order to edit an existing isolate, these props
        // should be defined. Otherwise the will be set to the default 'unamed isolate' values.
        sourceType: React.PropTypes.string,
        sourceName: React.PropTypes.string,

        // These props provide the information necessary to show a restricted dropdown list of potential sourceTypes.
        allowedSourceTypes: React.PropTypes.arrayOf(React.PropTypes.string),
        restrictSourceTypes: React.PropTypes.bool,

        onChange: React.PropTypes.func.isRequired,
        onSubmit: React.PropTypes.func.isRequired
    },

    getDefaultProps: function () {
        return {
            sourceType: 'unknown',
            sourceName: '',
            edit: true,
            restrictSourceTypes: false
        }
    },

    getInitialState: function () {
        return {
            sourceType: this.props.sourceType,
            sourceName: this.props.sourceName
        };
    },

    componentDidMount: function () {
        // Focus on the source type input when the component mounts.
        this.refs.sourceType.focus();
    },

    /**
     * Called when a change occurs in the sourceType input. Updates the sourceType state value. If the new value is
     * 'unknown', the sourceName is forced to an empty string.
     *
     * @func
     */
    handleChange: function (event) {
        var name = event.target.name;

        var updateObject;

        if (name === "sourceType") {
            updateObject = {
                sourceType: event.target.value.toLowerCase(),
                sourceName: event.target.value === 'unknown' ? '': this.props.sourceName
            };
        }

        if (name === "sourceName") {
            updateObject = {
                sourceName: event.target.value
            };
        }
        
        this.props.onChange(updateObject);
    },

    focus: function () {
        this.refs.sourceType.focus();
    },

    render: function () {

        var sourceTypeInput;

        var sourceTypeInputProps = {
            ref: 'sourceType',
            name: 'sourceType',
            label: 'Source Type',
            value: this.props.sourceType,
            onChange: this.handleChange
        };

        // If the is a restricted list of sourceTypes to choose from display a select field with the choices.
        if (dispatcher.settings.get('restrict_source_types')) {
            var optionComponents = dispatcher.settings.get('allowed_source_types').map(function (sourceType, index) {
                return <option key={index} value={sourceType}>{_.capitalize(sourceType)}</option>
            });

            sourceTypeInput = (
                <Input type='select' {...sourceTypeInputProps}>
                    <option key='default' value='unknown'>Unknown</option>
                    {optionComponents}
                </Input>
            );
        } else {
            sourceTypeInput = <Input type='text' {...sourceTypeInputProps} />;
        }

        return (
            <form onSubmit={this.props.onSubmit}>
                <Row>
                    <Col md={6}>
                        {sourceTypeInput}
                    </Col>
                    <Col md={6}>
                        <Input
                            type='text'
                            name='sourceName'
                            label='Source Name'
                            value={this.props.sourceName}
                            onChange={this.handleChange}
                            disabled={this.props.sourceType === 'unknown'}
                            spellCheck='off'
                        />
                    </Col>
                </Row>
            </form>
        );
    }
});

module.exports = IsolateForm;