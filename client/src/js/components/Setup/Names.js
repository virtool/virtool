/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupDatabaseName
 */

"use strict";

import React from "react";
import { ButtonToolbar, ListGroup } from "react-bootstrap";
import { Input, Icon, Button, ListGroupItem } from "virtool/js/components/Base"
import { postJSON } from "virtool/js/utils";

var Name = React.createClass({

    propTypes: {
        name: React.PropTypes.string.isRequired,
        active: React.PropTypes.bool.isRequired,
        updateName: React.PropTypes.func.isRequired,
        onFocus: React.PropTypes.func.isRequired
    },

    handleClick: function () {
        this.props.updateName(this.props.name);
    },

    render: function () {
        return (
            <ListGroupItem onFocus={this.props.onFocus} onClick={this.handleClick} active={this.props.active}>
                <Icon name="database" /> {this.props.name}
            </ListGroupItem>
        );
    }

});

var SetupDatabaseName = React.createClass({

    propTypes: {
        host: React.PropTypes.string,
        port: React.PropTypes.number,
        names: React.PropTypes.arrayOf(React.PropTypes.string),
        name: React.PropTypes.string.isRequired,
        updateSetup: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            name: this.props.name,
            pending: false
        };
    },

    componentDidMount: function () {
        this.refs.text.focus();
    },

    updateName: function (name) {
        this.setState({name: name.toLowerCase()});
    },

    handleRadioFocus: function () {
        this.refs.text.focus();
    },

    handleChange: function (event) {
        this.updateName(event.target.value);
    },

    handleSubmit: function (event) {
        event.preventDefault();

        const args = {
            host: this.props.host,
            port: this.props.port,
            name: this.state.name,
            operation: "check_db"
        };

        const callback = (data) => {
            this.setState({pending: false}, () => {
                if (!data.error) {
                    data.name = this.state.name;
                    this.props.checkedName(data);
                }
            });
        };

        postJSON("/", args, callback);
    },

    render: function () {

        var existingDatabases;

        if (this.props.names.length > 0) {
            existingDatabases = this.props.names.map(function (name, index) {
                return (
                    <Name
                        key={index}
                        name={name}
                        active={name === this.state.name}
                        updateName={this.updateName}
                        onFocus={this.handleRadioFocus}
                    />
                );
            }, this);

        } else {
            existingDatabases = (
                <ListGroupItem>
                    <Icon name="info" /> None found.
                </ListGroupItem>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <Input
                    ref="text"
                    type="text"
                    name="name"
                    label="Database Name"
                    onChange={this.handleChange}
                    spellCheck={false}
                    value={this.state.name}
                />

                <h5><strong>Existing Databases</strong></h5>
                <ListGroup>
                    {existingDatabases}
                </ListGroup>

                <ButtonToolbar className="pull-right">
                    <Button bsStyle="primary" type="submit" disabled={!Boolean(this.state.name)}>
                        <Icon name="floppy" pending={this.state.pending} /> Save
                    </Button>
                </ButtonToolbar>
            </form>
        );
    }

});

module.exports = SetupDatabaseName;