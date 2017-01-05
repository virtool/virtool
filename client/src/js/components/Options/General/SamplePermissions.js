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
import { Panel } from "react-bootstrap"
import { Help, Input } from "virtool/js/components/Base"

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
export default class SamplePermissions extends React.Component {

    static propTypes = {
        set: React.PropTypes.func,
        settings: React.PropTypes.object
    };

    changeRights = (right, value) => {
        ["read", "write"].forEach((op) => {
            this.props.set(`sample_${right}_${op}`, value.indexOf(op[0]) > -1);
        });
    };

    render () {

        const groupRights = (this.state.sampleGroupRead ? "r": "") + (this.state.sampleGroupWrite ? "w": "");
        const allRights = (this.state.sampleAllRead ? "r": "") + (this.state.sampleAllWrite ? "w": "");

        const rightProps = {
            onChange: this.changeRights,
            type: "select"
        };

        return (
            <Panel>
                <form onSubmit={this.add}>
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
                        ref="first"
                        value={this.state.sampleGroup}
                        onChange={(event) => this.props.set("sample_group", event.target.value)}
                    >
                        <option value="none">None</option>
                        <option value="force_choice">Force choice</option>
                        <option value="users_primary_group">User's primary group</option>
                    </Input>

                    <Input
                        {...rightProps}
                        label="Group Rights"
                        value={groupRights}
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
                        value={allRights}
                        onChange={(event) => this.changeRights("all", event.target.value)}
                    >
                        <option value="">None</option>
                        <option value="r">Read</option>
                        <option value="rw">Read & write</option>
                    </Input>
                </form>
            </Panel>
        );
    }
}
