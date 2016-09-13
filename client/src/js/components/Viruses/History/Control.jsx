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

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Input = require('react-bootstrap/lib/InputGroup');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

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
        this.refs.input.getInputDOMNode().focus();
    },

    selectIndex: function (event) {
        dispatcher.router.setExtra([event.target.value]);
    },

    render: function () {
        // Addons to label the input components.
        var findAddon = <span><Icon name='search' /> Find</span>;
        var selectAddon = <span><Icon name='hammer' /> Index</span>;

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
            type: 'select',
            onChange: this.selectIndex,
            addonBefore: selectAddon,
            value: this.props.selectedVersion
        };

        return (
            <Flex>
                <Flex.Item grow={1}>
                    <Input
                        ref='input'
                        type='text'
                        onChange={this.props.onFilter}
                        addonBefore={findAddon}
                        placeholder='Virus Name'
                    />
                </Flex.Item>
                <Flex.Item pad>
                    <Input {...selectProps}>
                        {optionComponents}
                    </Input>
                </Flex.Item>
            </Flex>
        );
    }

});

module.exports = HistoryControl;

