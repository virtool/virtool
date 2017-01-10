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

import React from "react";
import { Modal } from "react-bootstrap";
import { ConfirmFooter, Icon } from "virtool/js/components/Base";

import ConfirmVirus from "./Detail/ConfirmVirus";
import Isolates from "./Detail/Isolates";
import General from "./Detail/General";

const getInitialState = () => ({
    canModify: dispatcher.user.permissions.modify_virus,
    canRemove: dispatcher.user.permissions.remove_virus
});

/**
 * A modal component for editing and viewing virus details.
 *
 * @class
 */
export default class VirusDetail extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        onHide: React.PropTypes.func,
        detail: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.user.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.user.off("change", this.update);
    }

    update = () => {
        this.setState(getInitialState());
    };

    remove = () => {
        dispatcher.db.viruses.request("remove_virus", {_id: this.props.detail._id});
    };

    render () {

        let footer;

        if (this.state.canRemove) {
            footer = (
                <ConfirmFooter
                    {...this.props}
                    buttonContent={<span><Icon name="remove" /> Remove</span>}
                    callback={this.remove}
                    message="Are you sure you want to remove this virus?"
                />
            );
        }

        return (
            <div>
                <Modal.Header onHide={this.props.onHide} closeButton>
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
                        _id={this.props.detail._id}
                        show={this.props.detail.modified && this.state.canModify}
                        isolates={this.props.detail.isolates}
                    />
                </Modal.Body>

                {footer}
            </div>
        );
    }
}
