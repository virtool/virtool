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
var Modal = require('react-bootstrap/lib/Modal');
var Toggle = require('react-bootstrap-toggle').default;

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');


var UserSettings = React.createClass({

    propTypes: {
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        return _.pick(dispatcher.user.settings, ['show_ids', 'show_versions']);
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.update);
    },

    toggleShowField: function (key) {
        var value = !this.props.user.settings[key];

        dispatcher.db.users.request('change_user_setting', {
            _id: this.props.user.name,
            key: key,
            value: value
        });
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    toggleShowIds: function () {
        this.toggleShowField('show_ids')
    },

    toggleShowVersions: function () {
        this.toggleShowField('show_versions')
    },

    render: function () {

        var flexStyle = {
            marginBottom: "10px"
        };

        return (
            <Modal bsSize='small' show={this.props.show} onHide={this.props.onHide}>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    User Settings
                </Modal.Header>
                <Modal.Body>
                    <Flex alignItems="center" style={flexStyle}>
                        <Flex.Item>
                            <Toggle
                                active={this.props.user.settings.show_ids}
                                onChange={this.toggleShowIds}
                            />
                        </Flex.Item>
                        <Flex.Item pad={10}>
                            Show database IDs
                        </Flex.Item>
                    </Flex>
                    <Flex alignItems="center" style={flexStyle}>
                        <Flex.Item>
                            <Toggle
                                active={this.props.user.settings.show_versions}
                                onChange={this.toggleShowVersions}
                            />
                        </Flex.Item>
                        <Flex.Item pad={10}>
                            Show database versions
                        </Flex.Item>
                    </Flex>
                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = UserSettings;