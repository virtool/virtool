/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobsFilter
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var ReactDOM = require('react-dom');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var JobsFilter = React.createClass({

    propTypes: {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        onChange: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            task: '',
            username: ''
        };
    },

    componentDidMount: function () {
        // Focus on the first (task) form field when the component has mounted.
        ReactDOM.findDOMNode(this.refs.task).focus();
    },

    /**
     * Update the filterObject based on a input change event and call the onChange function with it.
     *
     * @param event {object} - the change event from the input element.
     * @func
     */
    handleChange: function (event) {
        var data = _.clone(this.state);

        data[event.target.name] = event.target.value;

        this.setState(data);

        var filterFunction = function (document) {
            return (
                (!data.task || document.task === data.task) &&
                (!data.username || document.username === data.username)
            );
        };

        // Pass the new filter object up to the parent component using the onChange function.
        this.props.onChange(filterFunction);
    },

    render: function () {
        // Create the option components for the selected fields.
        var optionComponents = {};

        _.forEach(['task', 'username'], function (field) {
            var options = _.uniq(_.map(this.props.documents, field));

            options.unshift('');

            optionComponents[field] = options.map(function (value) {
                return (
                    <option key={value} value={value}>
                        {field === 'task' ? _.startCase(value): value}
                    </option>
                );
            });
        }.bind(this));

        var sharedProps = {
            type: 'select',
            componentClass: 'select',
            onChange: this.handleChange
        };

        return (
            <Flex>
                <Flex.Item grow={1}>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name='briefcase' /> Task
                            </InputGroup.Addon>
                            <FormControl ref="task" name="task" {...sharedProps}>
                                {optionComponents.task}
                            </FormControl>
                        </InputGroup>
                    </FormGroup>
                </Flex.Item>

                <Flex.Item grow={1} pad>
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name='user' /> User
                            </InputGroup.Addon>
                            <FormControl ref="username" name="username" {...sharedProps}>
                                {optionComponents.username}
                            </FormControl>
                        </InputGroup>
                    </FormGroup>
                </Flex.Item>
            </Flex>
        );
    }
});

module.exports = JobsFilter;
