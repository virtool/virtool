/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports JobsToolbar
 */

import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import {InputGroup, FormGroup, FormControl, Dropdown, MenuItem} from "react-bootstrap";

import { test } from "../actions";
import { Icon, Button } from "virtool/js/components/Base";

class JobsToolbar extends React.Component {

    render () {

        let removalDropdown;

        removalDropdown = (
            <Dropdown id="job-clear-dropdown" onSelect={this.handleSelect} className="split-dropdown" pullRight>
                <Button onClick={this.clear} tip="Clear Finished">
                    <Icon name="remove" />
                </Button>
                <Dropdown.Toggle />
                <Dropdown.Menu>
                    <MenuItem eventKey="removeFailed">Failed</MenuItem>
                    <MenuItem eventKey="removeComplete">Complete</MenuItem>
                </Dropdown.Menu>
            </Dropdown>
        );

        return (
            <div className="toolbar">
                <FormGroup>
                    <InputGroup>
                        <InputGroup.Addon>
                            <Icon name="search" />
                        </InputGroup.Addon>
                        <FormControl />
                    </InputGroup>
                </FormGroup>

                <Button icon="lab" onClick={this.props.onTest} tip="Run Test" />

                <LinkContainer to="/jobs/resources">
                    <Button icon="meter" tip="Resources" />
                </LinkContainer>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {};
};

const mapDispatchToProps = (dispatch) => {
    return {
        onTest: () => {
            dispatch(test({long: true}));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(JobsToolbar);

export default Container;
