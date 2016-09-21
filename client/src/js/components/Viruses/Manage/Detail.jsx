/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusDetail
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Button = require('react-bootstrap/lib/Button');
var Modal = require('react-bootstrap/lib/Modal');
var Alert = require('react-bootstrap/lib/Alert');
var Label= require('react-bootstrap/lib/Label');

var ConfirmFooter = require('virtool/js/components/Base/ConfirmFooter.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

var ConfirmVirus = require('./detail/ConfirmVirus.jsx');
var Isolates = require('./detail/Isolates.jsx');
var General = require('./detail/General.jsx');

/**
 * A modal component for editing and viewing virus details.
 *
 * @class
 */
var VirusDetail = React.createClass({

    getInitialState: function () {
        return {
            canModify: dispatcher.user.permissions.modify_virus,
            canRemove: dispatcher.user.permissions.remove_virus
        };
    },

    componentDidMount: function () {
        dispatcher.user.on('change', this.update);
    },

    componentWillUnmount: function () {
        dispatcher.user.off('change', this.update);
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    /**
     * Remove a virus from the collection by sending a request to the server.
     *
     * @func
     */
    remove: function () {
        dispatcher.db.viruses.request('remove_virus', {_id: this.props.detail._id});
    },

    render: function () {

        var footer;

        if (this.state.canRemove) {
            footer = (
                <ConfirmFooter
                    {...this.props}
                    buttonContent={<span><Icon name='remove' /> Remove</span>}
                    callback={this.remove}
                    message='Are you sure you want to remove this virus?'
                />
            );
        }

        return (
            <div>
                <Modal.Header>
                    Virus Detail
                </Modal.Header>
                <Modal.Body>
                    <General
                        {...this.props.detail}
                        canModify={this.state.canModify}
                    />

                    <Isolates
                        data={this.props.detail.isolates}
                        virusId={this.props.detail._id}
                        settings={this.props.settings}
                        canModify={this.state.canModify}
                    />

                    <ConfirmVirus
                        show={this.props.detail.modified && this.state.canModify}
                        detail={this.props.detail}
                    />
                </Modal.Body>

                {footer}
            </div>
        );
    }
});

module.exports = VirusDetail;
