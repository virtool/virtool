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

import React from "react";
import { omit, includes, assign } from "lodash";
import { Navbar, Grid, Row, Col, Panel, ListGroup } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";
import { postJSON } from "virtool/js/utils";

import SetupConnection from "./Connection";
import SetupDatabaseName from "./Name";
import SetupDataPath from "./DataPath";
import SetupWatchPath from "./WatchPath";
import SetupFirstUser from "./FirstUser";
import SetupReload from "./Reload";
import SetupStep from "./Step";

const steps = [
    {
        key: "connection",
        label: "Connect to MongoDB",
        component: SetupConnection,

        shouldBeDisabled: function () {
            return false;
        },

        shouldBeReady: function (state) {
            return Boolean(state.names);
        }
    },
    {
        key: "database",
        label: "Choose database",
        component: SetupDatabaseName,

        shouldBeDisabled: function (state) {
            return !state.names;
        },

        shouldBeReady: function (state) {
            return Boolean(state.name);
        }
    },
    {
        key: "user",
        label: "Add first user",
        component: SetupFirstUser,

        shouldBeDisabled: function (state) {
            return !(state.name);
        },

        shouldBeReady: function (state) {
            return (state.username.length > 0 && state.password.length > 0) || (state.hasAdmin && state.accepted);
        }
    },
    {
        key: "data",
        label: "Data location",
        component: SetupDataPath,

        shouldBeDisabled: function (state) {
            return !(state.name);
        },

        shouldBeReady: function (state) {
            return Boolean(state.dataPath);
        }
    },
    {
        key: "watch",
        label: "Watch directory",
        component: SetupWatchPath,

        shouldBeDisabled: function () {
            return false;
        },

        shouldBeReady: function (state) {
            return Boolean(state.watchPath);
        }
    },
    {
        key: "reload",
        label: "Reload server",
        component: SetupReload,

        shouldBeDisabled: function () {
            return true;
        },

        shouldBeReady: function () {
            return false;
        }
    }
];

const Setup = React.createClass({

    getInitialState: function () {
        return {
            activeStepIndex: 0,

            names: null,

            host: "localhost",
            port: 27017,
            attempted: false,
            name: "",

            username: "",
            password: "",
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
        const args = omit(this.state, [
            "activeStepIndex",
            "names",
            "attempted",
            "hasAdmin",
            "accepted",
            "hasCollections"
        ]);

        args.new_server = !includes(this.state.names, this.state.name);
        args.operation = "save_setup";

        const callback = function () {
            window.location.reload();
        };

        postJSON("/", args, callback);
    },

    render: function () {

        const ContentComponent = steps[this.state.activeStepIndex].component;

        const contentProps = assign({
            gotConnection: this.gotConnection,
            checkedName: this.checkedName,
            acceptedAdmin: this.acceptedAdmin,
            setActiveStepIndex: this.setActiveStepIndex,
            updateSetup: this.updateSetup,
            nextStep: this.nextStep,
            saveAndReload: this.saveAndReload,
            reset: this.reset
        }, this.state);

        const stepComponents = steps.map(function (step, index) {
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
            <div>
                <Navbar>
                    <Navbar.Header>
                        <Navbar.Brand>
                            <Icon name="vtlogo" className="vtlogo"/>
                        </Navbar.Brand>
                        <Navbar.Text>
                            Setup
                        </Navbar.Text>
                    </Navbar.Header>
                </Navbar>

                <Grid>
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
                </Grid>
            </div>
        );
    }

});

export default Setup;
