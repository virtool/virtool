/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddGroup
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var ReactDOM = require('react-dom');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var InputGroup = require('react-bootstrap/lib/InputGroup');
var FormControl = require('react-bootstrap/lib/FormControl');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

var AddGroup = React.createClass({

    getInitialState: function () {
        return {
            groupName: '',
            error: null
        };
    },

    getInputDOMNode: function () {
        return ReactDOM.findDOMNode(this.refs.input);
    },

    handleSubmit: function (event) {
        event.preventDefault();

        var groupName = this.state.groupName.toLowerCase();

        // Make sure the new group name has no spaces in it.
        if (groupName.length > 0 && groupName.indexOf(' ') === -1) {
            this.setState({pending: true}, function () {
                dispatcher.db.groups.request('add', {
                    _id: groupName.toLowerCase()
                })
                .success(function () {
                    this.setState(this.getInitialState());
                }, this)
                .failure(function (data) {
                    this.setState({
                        pending: false,
                        error: data.message
                    })
                }, this);
            });
        } else {
            this.setState({
                error: 'Group names must not contain spaces and cannot be empty strings.'
            });
        }
    },

    handleChange: function (event) {
        this.setState({
            groupName: event.target.value,
            error: false
        });
    },

    render: function () {

        var overlay;

        if (this.state.error) {
            var overlayProps = {
                target: this.getInputDOMNode,
                animation: true,
                placement: "top"
            };

            overlay = (
                <Overlay {...overlayProps} show={true}>
                    <Popover id='input-error-popover'>
                        <span className="text-danger">{this.state.error}</span>
                    </Popover>
                </Overlay>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                {overlay}

                <FormGroup>
                    <InputGroup>
                        <FormControl
                            ref="input"
                            type="text"
                            placeholder='Group name'
                            value={this.state.groupName}
                            onChange={this.handleChange}
                        />
                        <InputGroup.Button>
                            <PushButton type='submit' bsStyle='primary'>
                                <Icon name='plus-square' /> Add
                            </PushButton>
                        </InputGroup.Button>
                    </InputGroup>
                </FormGroup>

            </form>
        );
    }
});

module.exports = AddGroup;
