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

import React from "react";
import { ButtonToolbar, ListGroup } from "react-bootstrap";
import { Input, Icon, Button, ListGroupItem } from "virtool/js/components/Base"
import { postJSON } from "virtool/js/utils";

const Name = (props) => (
    <ListGroupItem onFocus={props.onFocus} onClick={() => props.updateName(props.name)} active={props.active}>
        <Icon name="database" /> {props.name}
    </ListGroupItem>
);

Name.propTypes = {
    name: React.PropTypes.string.isRequired,
    active: React.PropTypes.bool.isRequired,
    updateName: React.PropTypes.func.isRequired,
    onFocus: React.PropTypes.func.isRequired
};

export default class SetupDatabaseName extends React.Component {

    constructor (props) {
        super(props);
        return {
            name: this.props.name,
            pending: false
        };
    }

    static propTypes = {
        host: React.PropTypes.string,
        port: React.PropTypes.number,
        names: React.PropTypes.arrayOf(React.PropTypes.string),
        name: React.PropTypes.string.isRequired,
        updateSetup: React.PropTypes.func.isRequired,
        checkedName: React.PropTypes.func
    };

    componentDidMount () {
        this.refs.text.focus();
    }

    updateName = (name) => this.setState({name: name.toLowerCase()});

    handleRadioFocus = () => this.refs.text.focus();

    handleChange = (event) => this.updateName(event.target.value);

    handleSubmit = (event) => {
        event.preventDefault();

        const args = {
            host: this.props.host,
            port: this.props.port,
            name: this.state.name,
            operation: "check_db"
        };

        postJSON("/", args, (data) => {
            this.setState({pending: false}, () => {
                if (!data.error) {
                    data.name = this.state.name;
                    this.props.checkedName(data);
                }
            });
        });
    };

    render () {

        let existingDatabases;

        if (this.props.names.length > 0) {
            existingDatabases = this.props.names.map((name, index) =>
                <Name
                    key={index}
                    name={name}
                    active={name === this.state.name}
                    updateName={this.updateName}
                    onFocus={this.handleRadioFocus}
                />
            );
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
                    <Button bsStyle="primary" type="submit" disabled={!(this.state.name)}>
                        <Icon name="floppy" pending={this.state.pending} /> Save
                    </Button>
                </ButtonToolbar>
            </form>
        );
    }

}
