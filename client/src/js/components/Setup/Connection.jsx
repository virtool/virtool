/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupConnection
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Input = require('react-bootstrap/lib/Input');
var Button = require('react-bootstrap/lib/Button');
var ButtonToolbar = require('react-bootstrap/lib/ButtonToolbar');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Utils = require('virtool/js/Utils');

var SetupConnection = React.createClass({

    propTypes: {
        host: React.PropTypes.string,
        port: React.PropTypes.number,
        names: React.PropTypes.arrayOf(React.PropTypes.string),
        gotConnection: React.PropTypes.func.isRequired,
        reset: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            host: this.props.host,
            port: this.props.port,
            attempted: false,
            pending: false
        };
    },

    componentDidMount: function () {
        this.refs.host.getInputDOMNode().focus();
    },

    componentDidUpdate: function (prevProps) {
        // If the connection was lost, put focus on the host input box again.
        if (!this.props.connected && prevProps.connected) this.refs.host.getInputDOMNode().focus();
    },

    handleChange: function (event) {
        if (this.props.names) this.props.reset();

        // Make a new object describing the new state.
        var newState = _.set({attempted: false}, event.target.name, event.target.value);

        // Force the changed value to lowercase if it is the Mongo host host.
        if (event.target.name === 'host') newState.host = newState.host.toLowerCase();
        if (event.target.name === 'port') newState.port = Number(newState.port);

        this.setState(newState);
    },

    connect: function () {
        this.setState({pending: true}, function () {

            var args = _.assign({operation: 'connect'}, this.state);
            
            var callback = function (data) {
                this.setState({attempted: true, pending: false}, function () {
                    if (data.names) {
                        this.props.gotConnection({
                            host: this.state.host,
                            port: this.state.port,
                            names: data.names
                        });
                    }
                });
            }.bind(this);

            Utils.postJSON('/', args, callback);
        });

    },

    handleSubmit: function (event) {
        event.preventDefault();
        if (!this.props.names) this.connect();
    },

    render: function () {
        
        var footer;

        if (!this.props.names) {
            if (this.state.attempted) {
                footer = (
                    <Alert bsStyle='danger'>
                        <p><strong><Icon name='warning' /> Could not connect to MongoDB.</strong></p>
                        <ul>
                            <li>Make sure MongoDB is installed and mongod is running.</li>
                            <li>Make sure the host and port values are correct.</li>
                        </ul>
                    </Alert>
                );
            } else {
                footer = (
                    <ButtonToolbar className='pull-right'>
                        <Button bsStyle='primary' type='submit'>
                            <Icon name='power-cord' pending={this.state.pending} /> Connect
                        </Button>
                    </ButtonToolbar>
                );
            }
        }

        if (this.props.names) {
            footer = (
                <Alert bsStyle='success'>
                    <Icon name='checkmark-circle' /> Connected to MongoDB.
                </Alert>
            )
        }

        var sharedProps = {
            bsStyle: !this.props.names && this.state.attempted ? 'error': null,
            onChange: this.handleChange,
            spellCheck: false
        };

        return (
            <form onSubmit={this.handleSubmit}>
                <Row>
                    <Col md={9}>
                        <Input
                            type='text'
                            ref='host'
                            name='host'
                            label='Host'
                            value={this.state.host}
                            {...sharedProps}
                        />
                    </Col>
                    <Col md={3}>
                        <Input
                            type='number'
                            name='port'
                            name='port'
                            label='Port'
                            value={this.state.port}
                            {...sharedProps}
                        />
                    </Col>
                </Row>

                {footer}

            </form>
        );
    }

});

module.exports = SetupConnection;