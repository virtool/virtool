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

import React from "react";
import { assign } from "lodash";
import { Row, Col, Alert, ButtonToolbar } from "react-bootstrap";
import { Button, Icon, Input } from "virtool/js/components/Base"
import { postJSON } from "virtool/js/utils";

export default class SetupConnection extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            host: this.props.host,
            port: this.props.port,
            attempted: false,
            pending: false
        };
    }

    static propTypes = {
        host: React.PropTypes.string,
        port: React.PropTypes.number,
        names: React.PropTypes.arrayOf(React.PropTypes.string),
        connected: React.PropTypes.bool,
        gotConnection: React.PropTypes.func.isRequired,
        reset: React.PropTypes.func.isRequired
    };

    componentDidUpdate (prevProps) {
        // If the connection was lost, put focus on the host input box again.
        if (!this.props.connected && prevProps.connected) this.refs.host.focus();
    }

    handleChange = (event) => {
        if (this.props.names) {
            this.props.reset();
        }

        // Make a new object describing the new state.
        let newState = {attempted: false};

        newState[event.target.name] = event.target.value;

        // Force the changed value to lowercase if it is the Mongo host host.
        if (event.target.name === "host") {
            newState.host = newState.host.toLowerCase();
        }

        if (event.target.name === "port") {
            newState.port = Number(newState.port);
        }

        this.setState(newState);
    };

    connect = () => {
        this.setState({pending: true}, () => {
            const args = assign({operation: "connect"}, this.state);

            postJSON("/", args, (data) => {
                this.setState({attempted: true, pending: false}, () => {
                    if (data.names) {
                        this.props.gotConnection({
                            host: this.state.host,
                            port: this.state.port,
                            names: data.names
                        });
                    }
                });
            });
        });

    };

    handleSubmit = (event) => {
        event.preventDefault();
        if (!this.props.names) {
            this.connect();
        }
    };

    render () {
        
        let footer;

        if (!this.props.names) {
            if (this.state.attempted) {
                footer = (
                    <Alert bsStyle="danger">
                        <p><strong><Icon name="warning" /> Could not connect to MongoDB.</strong></p>
                        <ul>
                            <li>Make sure MongoDB is installed and mongod is running.</li>
                            <li>Make sure the host and port values are correct.</li>
                        </ul>
                    </Alert>
                );
            } else {
                footer = (
                    <ButtonToolbar className="pull-right">
                        <Button bsStyle="primary" type="submit">
                            <Icon name="power-cord" pending={this.state.pending} /> Connect
                        </Button>
                    </ButtonToolbar>
                );
            }
        }

        if (this.props.names) {
            footer = (
                <Alert bsStyle="success">
                    <Icon name="checkmark-circle" /> Connected to MongoDB.
                </Alert>
            )
        }

        const sharedProps = {
            bsStyle: !this.props.names && this.state.attempted ? "error": null,
            onChange: this.handleChange,
            spellCheck: false
        };

        return (
            <form onSubmit={this.handleSubmit}>
                <Row>
                    <Col md={9}>
                        <Input
                            type="text"
                            inputRef={input => input.focus()}
                            name="host"
                            label="Host"
                            value={this.state.host}
                            {...sharedProps}
                        />
                    </Col>
                    <Col md={3}>
                        <Input
                            type="number"
                            name="port"
                            label="Port"
                            value={this.state.port}
                            {...sharedProps}
                        />
                    </Col>
                </Row>

                {footer}

            </form>
        );
    }
}
