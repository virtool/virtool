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
var Alert = require('react-bootstrap/lib/Alert');
var Button = require('react-bootstrap/lib/Button');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');
var Utils = require('virtool/js/Utils');

var SetupDatabase = React.createClass({

    getInitialState: function () {
        return {
            dataPath: this.props.dataPath,
            watchPath: this.props.watchPath
        };
    },

    componentDidMount: function () {
        this.refs.first.focus();
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
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

                <Input
                    type="text"
                    ref="first"
                    name="dataPath"
                    label="Data Path"
                    onChange={this.handleChange}
                    value={this.state.dataPath}
                />

                <Input
                    type='text'
                    name="watchPath"
                    label='Watch Path'
                    onChange={this.handleChange}
                    value={this.state.watchPath}
                />

                <Button bsStyle='primary' className='pull-right' type='submit'>
                    <Icon name='floppy' /> Save
                </Button>
            </form>
        );
    }

});

module.exports = SetupDatabase;
