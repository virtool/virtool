/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesFilter
 */

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Input = require('react-bootstrap/lib/Input');

var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * Serves as a filterComponent for the SamplesTable component. The sample name is the only field that can be sorted by.
 *
 * @class
 */
var Filter = React.createClass({

    propTypes: {
        onChange: React.PropTypes.func.isRequired
    },

    componentDidMount: function () {
        this.refs.name.getInputDOMNode().focus();
    },

    /**
     * Generates a new filterFunction to test documents and passes it to SampleTable through onChange. Triggered by a
     * change in the text input field.
     *
     * @param event {event} - the change event.
     * @func
     */
    handleChange: function (event) {
        var loweredQuery = event.target.value.toLowerCase();

        var filterFunction = function (document) {
            return document.name.toLowerCase().indexOf(loweredQuery) > -1;
        };

        this.props.onChange(filterFunction);
    },

    render: function () {

        return (
            <Input
                type='text'
                addonBefore={<span><Icon name='search' /> Find</span>}
                ref='name'
                onChange={this.handleChange}
                placeholder='Sample name'
            />
        );
    }

});

module.exports = Filter;