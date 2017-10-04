/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplePermissions
 */

import React from "react";
import { connect } from "react-redux";
import { Row, Col, Panel } from "react-bootstrap"

import { updateSettings } from "../../actions";
import { Help, Input } from "../../../base"

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
const SamplePermissions = (props) => {

    const rightProps = {
        onChange: props.onChangeRights,
        type: "select"
    };

    return (
        <Row>
            <Col md={12}>
                <h5><strong>Default Sample Permissions</strong></h5>
            </Col>
            <Col md={6}>
                <Panel>
                    <label className="control-label" style={{width: "100%"}}>
                        <span>Sample Group</span>
                        <Help pullRight>
                            <p>
                                <strong>None</strong>: samples are assigned no group and only <em>all users'</em> rights
                                apply
                            </p>
                            <p>
                                <strong>User's primary group</strong>: samples are automatically assigned the
                                creating user's primary group
                            </p>
                            <p>
                                <strong>Choose</strong>: samples are assigned by the user in the creation form
                            </p>
                        </Help>
                    </label>

                    <Input
                        type="select"
                        value={props.sampleGroup}
                        onChange={(e) => props.onChangeSampleGroup(e.target.value)}
                    >
                        <option value="none">None</option>
                        <option value="force_choice">Force choice</option>
                        <option value="users_primary_group">User's primary group</option>
                    </Input>

                    <Input
                        {...rightProps}
                        label="Group Rights"
                        value={props.group}
                        onChange={(event) => this.changeRights("group", event.target.value)}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>

                    <Input
                        name="all"
                        {...rightProps}
                        label="All Users' Rights"
                        value={props.all}
                        onChange={(event) => this.changeRights("all", event.target.value)}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>
                </Panel>
            </Col>
            <Col md={6}>
                <Panel>
                    Set the method used to assign groups to new samples and the default rights.
                </Panel>
            </Col>
        </Row>

    );
};

const mapStateToProps = (state) => {
    const settings = state.settings.data;

    return {
        sampleGroup: settings.sample_group,
        group: (settings.sample_group_read ? "r": "") + (settings.sample_group_write ? "w": ""),
        all: (settings.sample_all_read ? "r": "") + (settings.sample_all_write ? "w": "")
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onChangeSampleGroup: (value) => {
            dispatch(updateSettings({sample_group: value}));
        },

        onChangeRights: (right, value) => {
            let update = {};

            ["read", "write"].forEach(op => {
                update[`sample_${right}_${op}`] = value.indexOf(op[0]) > -1;
            });

            dispatch(updateSettings(update));
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SamplePermissions);

export default Container;
