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

import { test, clearJobs } from "../actions";
import { Icon, Button } from "virtool/js/components/Base";

const JobsToolbar = (props) => {

    let removalDropdown;

    if (props.canRemove) {
        removalDropdown = (
            <Dropdown id="job-clear-dropdown" className="split-dropdown" pullRight>
                <Button onClick={() => props.onClear()} tip="Clear Finished">
                    <Icon name="remove"/>
                </Button>
                <Dropdown.Toggle />
                <Dropdown.Menu>
                    <MenuItem eventKey="removeFailed" onClick={() => props.onClear("failed")}>
                        Failed
                    </MenuItem>
                    <MenuItem eventKey="removeComplete" onClick={() => props.onClear("complete")}>
                        Complete
                    </MenuItem>
                </Dropdown.Menu>
            </Dropdown>
        );
    }

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

            <Button icon="lab" onClick={props.onTest} tip="Run Test" />

            <LinkContainer to="/jobs/resources">
                <Button icon="meter" tip="Resources" />
            </LinkContainer>

            {removalDropdown}
        </div>
    );
};

const mapStateToProps = (state) => {
    return {
        canRemove: state.account.permissions.remove_job
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onTest: () => {
            dispatch(test({long: true}));
        },

        onClear: (scope) => {
            dispatch(clearJobs(scope));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(JobsToolbar);

export default Container;
