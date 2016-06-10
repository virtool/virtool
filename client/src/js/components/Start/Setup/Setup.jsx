/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Setup
 */

'use strict';

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Nav = require('react-bootstrap/lib/Nav');
var NavItem = require('react-bootstrap/lib/NavItem');
var Navbar = require('react-bootstrap/lib/Navbar');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Utils = require('virtool/js/Utils');

var SetupStep = require('./Step.jsx');

var steps = [
    {
        key: 'connection',
        label: 'Connect to MongoDB',
        component: require('./Connection.jsx'),

        shouldBeDisabled: function () {
            return false;
        },

        shouldBeReady: function (state) {
            return Boolean(state.names);
        }
    },
    {
        key: 'database',
        label: 'Choose database',
        component: require('./Names.jsx'),

        shouldBeDisabled: function (state) {
            return !state.names;
        },

        shouldBeReady: function (state) {
            return Boolean(state.name);
        }
    },
    {
        key: 'user',
        label: 'Add first user',
        component: require('./FirstUser.jsx'),

        shouldBeDisabled: function (state) {
            return !Boolean(state.name);
        },

        shouldBeReady: function (state) {
            return (state.username.length > 0 && state.password.length > 0) || (state.hasAdmin && state.accepted);
        }
    },
    {
        key: 'data',
        label: 'Data location',
        component: require('./DataPath.jsx'),

        shouldBeDisabled: function (state) {
            return !Boolean(state.name);
        },

        shouldBeReady: function (state) {
            return Boolean(state.dataPath);
        }
    },
    {
        key: 'watch',
        label: 'Import directory',
        component: require('./WatchPath.jsx'),

        shouldBeDisabled: function () {
            return false;
        },

        shouldBeReady: function (state) {
            return Boolean(state.watchPath);
        }
    },
    {
        key: 'reload',
        label: 'Reload server',
        component: require('./Reload.jsx'),

        shouldBeDisabled: function () {
            return true;
        },

        shouldBeReady: function () {
            return false;
        }
    }
];

var Setup = React.createClass({

    getInitialState: function () {
        return {
            activeStepIndex: 0,

            names: null,

            host: 'localhost',
            port: 27017,
            attempted: false,
            name: '',

            username: '',
            password: '',
            hasAdmin: false,
            accepted: false,

            dataPath: null,
            watchPath: null,
            hasCollections: false
        };
    },

    gotConnection: function (data) {
        this.setState(data, this.nextStep);
    },

    checkedName: function (data) {
        this.setState({
            name: data.name,
            hasAdmin: data.admin,
            hasCollections: data.collections
        }, this.nextStep);
    },

    acceptedAdmin: function () {
        this.setState({accepted: true}, this.nextStep);
    },

    reset: function () {
        this.setState(this.getInitialState());
    },

    setActiveStepIndex: function (stepIndex) {
        this.setState({activeStepIndex: stepIndex});
    },

    updateSetup: function (update, callback) {
        this.setState(update, callback);
    },

    nextStep: function () {
        this.setState({activeStepIndex: this.state.activeStepIndex + 1});
    },

    saveAndReload: function () {
        var args = _.omit(this.state, [
            'activeStepIndex',
            'names',
            'attempted',
            'hasAdmin',
            'accepted',
            'hasCollections'
        ]);

        args.new_server = !_.includes(this.state.names, this.state.name);
        args.operation = 'save_setup';

        var callback = function () {
            window.location.reload();
        };

        Utils.postJSON('/', args, callback);
    },

    render: function () {

        var ContentComponent = steps[this.state.activeStepIndex].component;

        var contentProps = _.assign({
            gotConnection: this.gotConnection,
            checkedName: this.checkedName,
            acceptedAdmin: this.acceptedAdmin,
            setActiveStepIndex: this.setActiveStepIndex,
            updateSetup: this.updateSetup,
            nextStep: this.nextStep,
            saveAndReload: this.saveAndReload,
            reset: this.reset
        }, this.state);

        var stepComponents = steps.map(function(step, index) {
            return (
                <SetupStep
                    key={index}
                    index={index}
                    label={step.label}
                    active={this.state.activeStepIndex === index}
                    disabled={step.shouldBeDisabled(this.state)}
                    ready={step.shouldBeReady(this.state)}
                    setActiveStepIndex={this.setActiveStepIndex}
                />
            );
        }, this);

        return (
            <Row>
                <Col md={10} mdOffset={1}>
                    <Navbar>
                        <Navbar.Header>
                            <Navbar.Brand>
                                <Icon name='vtlogo' className='vtlogo'/>
                            </Navbar.Brand>
                            <Nav>
                                <Navbar.Text>Setup</Navbar.Text>
                            </Nav>
                        </Navbar.Header>
                    </Navbar>

                    <Row>
                        <Col md={3}>
                            <ListGroup>
                                {stepComponents}
                            </ListGroup>
                        </Col>
                        <Col md={9}>
                            <Panel>
                                <ContentComponent
                                    {...contentProps}
                                />
                            </Panel>
                        </Col>
                    </Row>
                </Col>
            </Row>
        );
    }

});

module.exports = Setup;