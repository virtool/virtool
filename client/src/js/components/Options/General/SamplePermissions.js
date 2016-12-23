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

'use strict';

var _ = require('lodash');
import React from "react";
var Panel = require('react-bootstrap/lib/Panel');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');

var Input = require('virtool/js/components/Base/Input');
var Icon = require('virtool/js/components/Base/Icon');
var Help = require('virtool/js/components/Base/Help');

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
var SamplePermissions = React.createClass({

    getInitialState: function () {
        return {
            sampleGroup: dispatcher.settings.get('sample_group'),
            sampleGroupRead: dispatcher.settings.get('sample_group_read'),
            sampleGroupWrite: dispatcher.settings.get('sample_group_write'),
            sampleAllRead: dispatcher.settings.get('sample_all_read'),
            sampleAllWrite: dispatcher.settings.get('sample_all_write')
        };
    },

    componentDidMount: function () {
        dispatcher.settings.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.settings.off('change', this.update);
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state !== nextState;
    },

    changePrimaryGroup: function (event) {
        dispatcher.settings.set('sample_group', event.target.value);
    },

    changeRights: function (event) {
        var prefix = 'sample_' + event.target.name + '_';

        ['read', 'write'].forEach(function (op) {
            dispatcher.settings.set(prefix + op, event.target.value.indexOf(op[0]) > -1)
        });
    },

    /**
     * Updates the sourceTypes and enabled state when the settings object emits and update event.
     *
     * @func
     */
    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {

        var groupRights = (this.state.sampleGroupRead ? 'r': '') + (this.state.sampleGroupWrite ? 'w': '');
        var allRights = (this.state.sampleAllRead ? 'r': '') + (this.state.sampleAllWrite ? 'w': '');

        var rightProps = {
            onChange: this.changeRights,
            type: 'select'
        };

        return (
            <Panel>
                <form onSubmit={this.add}>
                    <label className='control-label' style={{width: '100%'}}>
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
                    <Input type='select' ref='first' value={this.state.sampleGroup} onChange={this.changePrimaryGroup}>
                        <option value='none'>None</option>
                        <option value='force_choice'>Force choice</option>
                        <option value='users_primary_group'>User's primary group</option>
                    </Input>

                    <Input name='group' {...rightProps} label='Group Rights' value={groupRights}>
                        <option value=''>None</option>
                        <option value='r'>Read</option>
                        <option value='rw'>Read & write</option>
                    </Input>

                    <Input name='all' {...rightProps} label="All Users' Rights" value={allRights}>
                        <option value=''>None</option>
                        <option value='r'>Read</option>
                        <option value='rw'>Read & write</option>
                    </Input>
                </form>
            </Panel>
        );
    }

});

module.exports = SamplePermissions;

