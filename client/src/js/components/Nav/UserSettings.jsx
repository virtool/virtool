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
var Input = require('react-bootstrap/lib/Input');
var Modal = require('react-bootstrap/lib/Modal');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var PushListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var Checkbox = require('virtool/js/components/Base/Checkbox.jsx');

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

        dispatcher.collections.users.request('change_user_setting', {
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

        return (
            <Modal bsSize='small' {...this.props}>
                <Modal.Header>
                    User Settings
                </Modal.Header>
                <Modal.Body>
                    <ListGroup>
                        <PushListGroupItem onClick={this.toggleShowIds}>
                            <Checkbox checked={this.props.user.settings.show_ids} /> Show database IDs
                        </PushListGroupItem>
                        <PushListGroupItem onClick={this.toggleShowVersions}>
                            <Checkbox checked={this.props.user.settings.show_versions} /> Show database versions
                        </PushListGroupItem>
                    </ListGroup>

                </Modal.Body>
            </Modal>
        );
    }
});

module.exports = UserSettings;