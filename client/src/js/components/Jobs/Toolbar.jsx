/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobsToolbar
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
var JobsToolbar = React.createClass({

    propTypes: {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        onChange: React.PropTypes.func.isRequired
    },

    componentDidMount: function () {
        // Focus on the first (task) form field when the component has mounted.
        this.refs.task.getInputDOMNode().focus();
    },

    /**
     * Update the filterObject based on a input change event and call the onChange function with it.
     *
     * @param event {object} - the change event from the input element.
     * @func
     */
    handleChange: function (event) {
        var re = {
            task: new RegExp(this.refs.task.getValue(), 'i'),
            username: new RegExp(this.refs.username.getValue(), 'i')
        };

        var filterFunction = function (document) {
            return re.task.test(document.task) && re.username.test(document.username);
        };

        // Pass the new filter object up to the parent component using the onChange function.
        this.props.onChange(filterFunction);
    },

    render: function () {
        // Nice addons for the Input components.
        var taskAddon = <span><Icon name='briefcase' /> Task</span>;
        var userAddon = <span><Icon name='user' /> User</span>;

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
            onChange: this.handleChange
        };

        return (
            <Row>
                <Col md={6}>
                    <Input {...sharedProps} name='task' addonBefore={taskAddon} ref='task'>
                        {optionComponents.task}
                    </Input>
                </Col>
                <Col md={6}>
                    <Input {...sharedProps} name='username' addonBefore={userAddon} ref='username'>
                        {optionComponents.username}
                    </Input>
                </Col>
            </Row>
        );
    }
});

module.exports = JobsToolbar;
