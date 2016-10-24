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

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');
var FormGroup = require('react-bootstrap/lib/FormGroup');
var FormControl = require('react-bootstrap/lib/FormControl');
var ControlLabel = require('react-bootstrap/lib/ControlLabel');

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Modal = require('virtool/js/components/Base/Modal.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');


var UserSettings = React.createClass({

    propTypes: {
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return _.assign({pending: false}, dispatcher.user.settings);
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
                                <Flex.Item>
                                    <Checkbox checked={this.props.user.settings.show_ids} />
                                </Flex.Item>
                                <Flex.Item pad={7}>
                                    Show database IDs
                                </Flex.Item>
                            </Flex>
                        </div>

                        <div onClick={this.toggleShowVersions}>
                            <Flex {...checkboxProps}>
                                <Flex.Item>
                                    <Checkbox checked={this.props.user.settings.show_versions} />
                                </Flex.Item>
                                <Flex.Item pad={7}>
                                    Show database versions
                                </Flex.Item>
                            </Flex>
                        </div>
                    </Panel>

                    <Panel header="Quick Analyze">
                        <div onClick={this.toggleSkipQuickAnalyzeDialog}>
                            <Flex {...checkboxProps}>
                                <Flex.Item>
                                    <Checkbox checked={this.props.user.settings.skip_quick_analyze_dialog} />
                                </Flex.Item>
                                <Flex.Item pad={7}>
                                    Skip quick analyze dialog
                                </Flex.Item>
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