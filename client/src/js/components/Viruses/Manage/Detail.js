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

import React from "react";
import { Button, ConfirmFooter, Icon, Modal } from "virtool/js/components/Base";

var ConfirmVirus = require('./Detail/ConfirmVirus');
var Isolates = require('./Detail/Isolates');
var General = require('./Detail/General');

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
