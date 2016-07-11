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

var React = require('react');
var Numeral = require('numeral');

var LinkedStateMixin = require('react-addons-linked-state-mixin');
var Input = require('react-bootstrap/lib/Input');
var Modal = require('react-bootstrap/lib/Modal');
var Table = require('react-bootstrap/lib/Table');
var Button = require('react-bootstrap/lib/Button');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component based on React-Bootstrap Modal that presents a form used to add a new host from a FASTA file.
 */
var AddHost = React.createClass({

    mixins: [LinkedStateMixin],

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

    componentWillReceiveProps: function (nextProps) {
        // Clear state if the modal is closing.
        if (this.props.show && !nextProps.show) this.setState(this.getInitialState())
    },

    componentDidUpdate: function (prevProps) {
        // Focus on the first input if the modal was just opened.
        if (!prevProps.show && this.props.show) this.refs.firstInput.getInputDOMNode().focus();
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
            dispatcher.collections.hosts.request('add', {
                file: this.props.target._id,
                description: this.state.description,
                organism: this.state.organism
            }, this.props.onHide);
        }
    },

    render: function () {
        // The form is submittable if both fields are filled.
        var submittable = this.state.organism.length > 0 && this.state.description.length > 0;

        var content;

        if (this.props.show && this.props.target) {
            content = (
                <form onSubmit={this.handleSubmit}>
                    <Modal.Header>
                        Add Host
                    </Modal.Header>
                    <Modal.Body>
                        <Input ref='firstInput' type='text' placeholder='Organism Name' valueLink={this.linkState('organism')} />
                        <Input type='text' placeholder='Description' valueLink={this.linkState('description')} />

                        <Table bordered condensed>
                            <tbody>
                                <tr>
                                    <th className='col-sm-5'>Organism Name</th>
                                    <td className='col-sm-7'>{this.state.organism}</td>
                                </tr>
                                <tr>
                                    <th>Description</th>
                                    <td>{this.state.description}</td>
                                </tr>
                                <tr>
                                    <th>File</th>
                                    <td>{this.props.target._id}</td>
                                </tr>

                                <tr>
                                    <th>Size</th>
                                    <td>{Numeral(this.props.target.size).format('0.0 b')}</td>
                                </tr>
                            </tbody>
                        </Table>
                    </Modal.Body>
                    <Modal.Footer className='modal-footer'>
                        <Button onClick={this.props.onHide}>Cancel</Button>
                        <Button type='submit' onClick={this.submit} bsStyle='primary' disabled={!submittable}>
                            <Icon name='plus-square' /> Add
                        </Button>
                    </Modal.Footer>
                </form>
            );
        }

        return (
            <Modal {...this.props}>
                {content}
            </Modal>
        )
    }

});

module.exports = AddHost;