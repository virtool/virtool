/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserSettings
 */

'use strict';

import React from 'react';
import { assign } from "lodash";
import { Panel, FormGroup, FormControl, ControlLabel } from 'react-bootstrap';
import { Flex, FlexItem, Modal, Checkbox } from 'virtool/js/components/Base';

var UserSettings = React.createClass({

    propTypes: {
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return assign({pending: false}, dispatcher.user.settings);
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.update);
    },

    requestSet: function (key, value) {
        this.setState({pending: true}, function () {
            dispatcher.db.users.request('change_user_setting', {
                _id: this.props.user.name,
                key: key,
                value: value
            }).success(function () {
                this.setState({
                    pending: false
                });
            }, this);
        });
    },

    toggleSetting: function (key) {
        this.requestSet(key, !this.props.user.settings[key]);
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    toggleShowIds: function () {
        this.toggleSetting('show_ids')
    },

    toggleShowVersions: function () {
        this.toggleSetting('show_versions')
    },

    toggleSkipQuickAnalyzeDialog: function () {
        this.toggleSetting('skip_quick_analyze_dialog');
    },

    setQuickAnalyzeAlgorithm: function (event) {
        this.requestSet("quick_analyze_algorithm", event.target.value);
    },

    render: function () {

        var checkboxProps = {
            style: {
                marginBottom: "10px"
            },

            className: "pointer"
        };

        return (
            <Modal bsSize='small' show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    User Settings
                </Modal.Header>

                <Modal.Progress active={this.state.pending} />

                <Modal.Body>
                    <Panel header="Display">
                        <div onClick={this.toggleShowIds}>
                            <Flex {...checkboxProps}>
                                <FlexItem>
                                    <Checkbox checked={this.props.user.settings.show_ids} />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Show database IDs
                                </FlexItem>
                            </Flex>
                        </div>

                        <div onClick={this.toggleShowVersions}>
                            <Flex {...checkboxProps}>
                                <FlexItem>
                                    <Checkbox checked={this.props.user.settings.show_versions} />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Show database versions
                                </FlexItem>
                            </Flex>
                        </div>
                    </Panel>

                    <Panel header="Quick Analyze">
                        <div onClick={this.toggleSkipQuickAnalyzeDialog}>
                            <Flex {...checkboxProps}>
                                <FlexItem>
                                    <Checkbox checked={this.props.user.settings.skip_quick_analyze_dialog} />
                                </FlexItem>
                                <FlexItem pad={7}>
                                    Skip quick analyze dialog
                                </FlexItem>
                            </Flex>
                        </div>

                        <FormGroup controlId="defaultAlgorithmLabel">
                            <ControlLabel>
                                <small>Default Algorithm</small>
                            </ControlLabel>
                            <FormControl componentClass="select" onChange={this.setQuickAnalyzeAlgorithm} value={this.props.user.settings.quick_analyze_algorithm}>
                                <option value="pathoscope_bowtie">PathoscopeBowtie</option>
                                <option value="pathoscope_snap">PathoscopeSNAP</option>
                                <option value="nuvs">NuVs</option>
                            </FormControl>
                        </FormGroup>
                    </Panel>
                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = UserSettings;