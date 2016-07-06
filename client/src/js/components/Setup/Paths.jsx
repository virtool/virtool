/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupDatabase
 */

'use strict';

var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var Input = require('react-bootstrap/lib/Input');
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Utils = require('virtool/js/Utils');


var SetupDatabase = React.createClass({

    mixins: [LinkedStateMixin],

    getInitialState: function () {
        return {
            dataPath: this.props.dataPath,
            watchPath: this.props.watchPath
        };
    },

    componentDidMount: function () {
        this.refs.first.getInputDOMNode().focus();
    },

    handleSubmit: function (event) {
        event.preventDefault();

        var args = {
            host: this.props.host,
            port: this.props.port,
            name: this.state.name,
            operation: 'check_db'
        };

        var callback = function (data) {
            this.setState({pending: false}, function () {
                if (!data.error) {
                    data.name = this.state.name;
                    this.props.checkedName(data);
                }
            });
        }.bind(this);

        Utils.postJSON('/', args, callback);
    },

    render: function () {
        var alert;

        if (this.props.hasCollections) {
            alert = (
                <Alert bsStyle='danger'>
                    <span>
                        The chosen database already exists and contains Virtool data collections. These collections
                        require matching files on disk to work properly. Virtool will not work if the paths entered
                        below do not match the paths used when database records were created.
                    </span>
                </Alert>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                {alert}

                <Input type='text' ref='first' label='Data Path' valueLink={this.linkState('dataPath')} />
                <Input type='text' label='Watch Path' valueLink={this.linkState('watchPath')} />

                <Button bsStyle='primary' className='pull-right' type='submit'>
                    <Icon name='floppy' /> Save
                </Button>
            </form>
        );
    }

});

module.exports = SetupDatabase;
