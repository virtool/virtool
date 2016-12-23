/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AddHost
 */
import React from "react";
import {Modal, Button} from "react-bootstrap";
import Icon from "virtool/js/components/Base/Icon";
import Input from "virtool/js/components/Base/Input";

/**
 * A component based on React-Bootstrap Modal that presents a form used to add a new host from a FASTA file.
 */
export const AddHost = React.createClass({

    propTypes: {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired,
        target: React.PropTypes.object
    },

    getInitialState: function () {
        // The only state is the form input field content.
        return {
            organism: '',
            description: ''
        }
    },

    modalEnter: function () {
        this.refs.organism.focus();
    },

    modalExited: function () {
        this.setState(this.getInitialState());
    },

    handleChange: function (event) {
        var data = {};
        data[event.target.name] = event.target.value;

        this.setState(data);
    },

    /**
     * Callback triggered by the form submit event. Sends a request to the server requesting a new job for adding a new
     * host. If the request is successful, the modal will close.
     *
     * @param event {object} - the submit event; used only to prevent the default behaviour
     */
    handleSubmit: function (event) {
        event.preventDefault();

        // Only submit the request if the two form fields are filled.
        if (this.state.organism.length > 0 && this.state.description.length > 0) {
            dispatcher.db.hosts.request('add', {
                file: this.props.target._id,
                description: this.state.description,
                organism: this.state.organism
            }).success(this.props.onHide);
        }
    },

    render: function () {
        // The form is submittable if both fields are filled.
        var submittable = this.state.organism.length > 0 && this.state.description.length > 0;

        var content;

        var organismStyle = {
            fontStyle: "italic"
        };

        if (this.props.show && this.props.target) {
            content = (
                <form onSubmit={this.handleSubmit}>
                    <Modal.Header>
                        Add Host
                    </Modal.Header>

                    <Modal.Body>
                        <Input
                            ref='organism'
                            type='text'
                            name="organism"
                            label="Organism"
                            value={this.state.organism}
                            onChange={this.handleChange}
                            style={organismStyle}
                        />
                        <Input
                            type='text'
                            name="description"
                            label="Description"
                            value={this.state.description}
                            onChange={this.handleChange}
                        />
                        <Input
                            type="text"
                            label="File"
                            value={this.props.target._id}
                            readOnly
                        />
                    </Modal.Body>

                    <Modal.Footer className='modal-footer'>
                        <Button onClick={this.props.onHide}>Cancel</Button>
                        <Button type='submit' onClick={this.submit} bsStyle='primary' disabled={!submittable}>
                            <Icon name='plus-square'/> Add
                        </Button>
                    </Modal.Footer>
                </form>
            );
        }

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} onEnter={this.modalEnter}
                   onExited={this.modalExited}>
                {content}
            </Modal>
        )
    }

});

module.exports = AddHost;