/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HistoryControl
 */

'use strict';

import React from "react";
import ReactDOM from "react-dom";
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');

var Flex = require('virtool/js/components/Base/Flex');
var Icon = require('virtool/js/components/Base/Icon');

/**
 * A control bar that is shown above the history documents. Allows searching for changes in a particular virus and for
 * filtering changes by the index they were included in.
 *
 * @class
 */
var HistoryControl = React.createClass({

    propTypes: {
        indexVersions: React.PropTypes.array,
        selectedVersion: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
        onFilter: React.PropTypes.func
    },

    componentDidMount: function () {
        ReactDOM.findDOMNode(this.refs.input).focus();
    },

    selectIndex: function (event) {
        dispatcher.router.setExtra([event.target.value]);
    },

    render: function () {
        // The options to put in the select box component.
        var optionComponents = this.props.indexVersions.map(function (indexVersion) {
            return (
                <option key={indexVersion} value={indexVersion}>
                    {indexVersion === 'unbuilt' ? 'Unbuilt Changes': 'Version ' + indexVersion}
                </option>
            );
        });

        // Props to pass to the select box input component.
        var selectProps = {
            componentClass: 'select',
            onChange: this.selectIndex,
            value: this.props.selectedVersion
        };

        return (
            <Flex>
                <Flex.Item grow={1}>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name='search' /> Find
                            </InputGroup.Addon>
                            <FormControl
                                ref='input'
                                type='text'
                                onChange={this.props.onFilter}
                                placeholder='Virus Name'
                            />
                        </InputGroup>
                    </FormGroup>
                </Flex.Item>
                <Flex.Item pad>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name='hammer' /> Index
                            </InputGroup.Addon>
                            <FormControl {...selectProps}>
                                {optionComponents}
                            </FormControl>
                        </InputGroup>
                    </FormGroup>
                </Flex.Item>
            </Flex>
        );
    }

});

module.exports = HistoryControl;

