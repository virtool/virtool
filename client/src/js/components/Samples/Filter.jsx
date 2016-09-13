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
var ReactDOM = require('react-dom');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');

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
        ReactDOM.findDOMNode(this.refs.name).focus();
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
            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name='search' /> Find
                    </InputGroup.Addon>
                    <FormControl
                        type='text'
                        ref='name'
                        onChange={this.handleChange}
                        placeholder='Sample name'
                    />
                </InputGroup>
            </FormGroup>
        );
    }

});

module.exports = Filter;