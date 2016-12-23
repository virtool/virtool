/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports QuickAnalyze
 *
 */

'use strict';

import React from "react";
import { Flex, Icon, Input, Modal, Checkbox, Button } from 'virtool/js/components/Base';

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
var QuickAnalyze = React.createClass({

    propTypes: {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return {
            name: "",
            algorithm: dispatcher.user.settings.quick_analyze_algorithm || "pathoscope_bowtie",

            useAsDefault: false,
            skipQuickAnalyzeDialog: false,

            pending: false
        };
    },

    modalWillEnter: function () {
        this.refs.name.focus();
    },

    modalExited: function () {
        this.setState(this.getInitialState());
    },

    handleChange: function (event) {
        var state = {};
        state[event.target.name] = event.target.value;
        this.setState(state);
    },

    handleSubmit: function (event) {
        event.preventDefault();

        this.setState({pending: true}, function () {
            dispatcher.db.samples.request('analyze', {
            samples: [dispatcher.router.route.extra[1]],
            algorithm: this.state.algorithm,
            name: this.state.name || null
        }).success(function () {

            if (this.state.useAsDefault) {
                dispatcher.db.users.request('change_user_setting', {
                    _id: dispatcher.user.name,
                    key: "quick_analyze_algorithm",
                    value: this.state.algorithm
                });
            }

            if (this.state.skipQuickAnalyzeDialog) {
                dispatcher.db.users.request('change_user_setting', {
                    _id: dispatcher.user.name,
                    key: "skip_quick_analyze_dialog",
                    value: true
                });
            }

            this.props.onHide();

        }, this);});
    },

    toggleUseAsDefault: function () {
        this.setState({
            useAsDefault: !this.state.useAsDefault
        });
    },

    toggleSkipQuickAnalyzeDialog: function () {
        this.setState({
            skipQuickAnalyzeDialog: !this.state.skipQuickAnalyzeDialog
        });
    },

    render: function () {

        var sampleName = dispatcher.db.samples.by("_id", dispatcher.router.route.extra[1]).name;

        var checkboxProps = {

            className: "pointer",

            style: {
                paddingLeft: "1px",
                paddingTop: "10px"
            }
        };

        return (
            <Modal bsSize="small" show={this.props.show} onHide={this.props.onHide} onEnter={this.modalWillEnter} onExited={this.modalExited}>
                <form onSubmit={this.handleSubmit}>
                    <Modal.Header onHide={this.props.onHide} closeButton>
                        Quick Analyze
                    </Modal.Header>

                    <Modal.Progress active={this.state.pending} />

                    <Modal.Body>

                            <Input
                                label="Sample"
                                value={sampleName}
                                readOnly={true}
                            />

                            <Input
                                ref="name"
                                name="name"
                                label="Analysis Name"
                                value={this.state.name}
                                onChange={this.handleChange}
                                disabled={true}
                            />

                            <Input name="algorithm" type='select' label="Algorithm" value={this.state.algorithm} onChange={this.handleChange}>
                                <option value="pathoscope_bowtie">PathoscopeBowtie</option>
                                <option value="pathoscope_snap">PathoscopeSNAP</option>
                                <option value="nuvs">NuVs</option>
                            </Input>

                            <div onClick={this.toggleUseAsDefault} {...checkboxProps}>
                                <Flex>
                                    <Flex.Item>
                                        <Checkbox checked={this.state.useAsDefault || this.state.skipQuickAnalyzeDialog}  />
                                    </Flex.Item>
                                    <Flex.Item pad={7}>
                                        Set as default algorithm
                                    </Flex.Item>
                                </Flex>
                            </div>

                            <div onClick={this.toggleSkipQuickAnalyzeDialog} {...checkboxProps}>
                                <Flex>
                                    <Flex.Item>
                                        <Checkbox checked={this.state.skipQuickAnalyzeDialog}  />
                                    </Flex.Item>
                                    <Flex.Item pad={7}>
                                        Skip this dialog from now on
                                    </Flex.Item>
                                </Flex>
                            </div>
                    </Modal.Body>

                    <Modal.Footer>
                        <Button type='submit' bsStyle='primary'>
                            <Icon name='new-entry' /> Create
                        </Button>
                    </Modal.Footer>
                </form>
            </Modal>
        );
    }
});

module.exports = QuickAnalyze;