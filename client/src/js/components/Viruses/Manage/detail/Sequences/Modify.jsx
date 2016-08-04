/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ModifySequence
 */

'use strict';

var React = require('react');
var Overlay = require('react-bootstrap/lib/Overlay');
var Popover = require('react-bootstrap/lib/Popover');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var LoadingOverlay = require('virtool/js/components/Base/LoadingOverlay.jsx');
var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var SequenceForm = require('./Form.jsx');
var SequenceHeader = require('./Header.jsx');

/**
 * A regular expression object used to test if a string contains spaces. Used to make sure the there are no spaces in
 * a supplied accession.
 *
 * @type {RegExp}
 * @object
 */
var SpaceRegEx = new RegExp(' ');

/**
 * A component that allows a sequence to be added or edited.
 *
 * @class
 */
var ModifySequence = React.createClass({

    propTypes: {
        // Data describing the sequence document.
        virusId: React.PropTypes.string.isRequired,
        isolateId: React.PropTypes.string.isRequired,
        sequenceId: React.PropTypes.string,
        definition: React.PropTypes.string,
        host: React.PropTypes.string,
        sequence: React.PropTypes.string,
        canModify: React.PropTypes.bool
    },

    getDefaultProps: function () {
        return {
            sequenceId: null,
            definition: '',
            host: '',
            sequence: ''
        };
    },

    getInitialState: function () {
        return {
            sequenceId: this.props.sequenceId || '',
            definition: this.props.definition,
            host: this.props.host,
            sequence: this.props.sequence,

            // State the manages the appearance of the component. The component is pending when the form has been saved
            // and a spinner is shown. The error state is used to display error popovers on the accession field.
            pending: null,
            error: null
        };
    },

    componentDidUpdate: function (prevProps, prevState) {
        // If the sequenceId (accession) changes, dismiss errors displayed in popovers overlaid on the field.
        if (prevState.error && prevState.sequenceId !== this.state.sequenceId) this.dismissError();
    },

    /**
     * Dismisses and errors displayed on the accession field.
     *
     * @func
     */
    dismissError: function () {
        this.setState({error: null});
    },

    /**
     * Send a request to the server to upsert a sequence. Triggered by clicking the save icon button (blue floppy) or
     * by a submit event on the form.
     *
     * @param event {object} - the event that triggered this callback. Will be used to prevent the default action.
     * @func
     */
    save: function (event) {
        event.preventDefault();

        // Save the form data unless the accession contains spaces.
        if (SpaceRegEx.test(this.state.sequenceId)) {
            this.setState({error: 'Accession may not contain spaces.'});
        } else {
            var newEntry = _.pick(this.state, ['definition', 'host', 'sequence']);

            newEntry._id = this.state.sequenceId;
            newEntry.isolate_id = this.props.isolateId;

            dispatcher.db.viruses.request(!this.props.sequenceId ? 'add_sequence': 'update_sequence', {
                _id: this.props.virusId,
                isolate_id: this.props.isolateId,
                new: newEntry
            }, this.props.onEdit, this.onSaveFailure);
        }
    },

    /**
     * Sends a request to the server to get NCBI data for the current accession (sequenceId) entered in the accession
     * field. Handlers deal with the data from NCBI received in a successful transaction or the failure of the request.
     *
     * @func
     */
    autofill: function () {
        this.setState({pending: 'Fetching'}, function () {
            dispatcher.db.viruses.request('fetch_ncbi', {
                accession: this.state.sequenceId
            }).success(this.onAutofillSuccess).failure(this.onAutofillFailure);
        });
    },

    /**
     * Function to deal with a successful autofill from NCBI. Data is passed in from the successful transaction.
     *
     * @param data {object} - the sequence data received from NCBI through the VT server.
     * @func
     */
    onAutofillSuccess: function (data) {
        // Remove the accession from the data as this is already entered in the form and we don't want it to change.
        delete data.accession;

        // Get rid of the pending state causing a 'Fetching' message to be overlaid on the sequence ListGroupitem.
        data.pending = null;

        // Update state.
        this.setState(data);
    },

    /**
     * Called when the autofill request fails. Displays an error popover on the accession field indicating that data
     * could not be found for the supplied accession.
     *
     * @func
     */
    onAutofillFailure: function () {
        this.setState({
            pending: null,
            error: 'Could not find data for accession.'
        });
    },

    /**
     * Callback for when a save request fails. Failure is always due to the provided accession already existing in the
     * database. Display a message indicating so by setting error.state.
     *
     * @func
     */
    onSaveFailure: function () {
        this.setState({
            pending: null,
            error: 'Accession already exists in database.'
        })
    },

    /**
     * Set state in response to a change in a form field element.
     *
     * @param event {object} - the change event.
     * @func
     */
    handleChange: function (event) {
        var state = {};
        state[event.target.name] = event.target.value;
        this.setState(state);
    },

    render: function () {
        // Set to true if the appearance should be configured for adding a new sequence rather than editing an existing
        // one.
        var adding = this.props.sequenceId === null;

        // Icons to show in the header of the sequence component.
        var icons;

        if (!this.state.pending && this.props.canModify) {
            
            // Show a save icon if there is no error for the accession field.
            var saveIcon = !this.state.error ? (
                <Icon
                    name='floppy'
                    bsStyle='primary'
                    onClick={this.save}
                />
            ) : null;

            icons = (
                <span>
                    {saveIcon}
                    <Icon name='cancel-circle' bsStyle='danger' onClick={this.props.onEdit} />
                </span>
            );
        }

        var overlay;

        if (this.state.error) {
            // Set up an overlay to display if there is an error in state.
            var overlayProps = {
                target: this.refs.form.getAccessionNode,
                animation: false,
                placement: 'top'
            };

            overlay = (
                <Overlay {...overlayProps} show={true} onHide={this.dismissError}>
                    <Popover id='sequence-error-popover'>
                        {this.state.error}
                    </Popover>
                </Overlay>
            );
        }

        return (
            <ListGroupItem className={'band ' + (adding ? 'primary': 'warning')} allowFocus>
                <SequenceHeader sequenceId={this.state.sequenceId} definition={this.state.definition}>
                    {icons}
                </SequenceHeader>

                <LoadingOverlay show={Boolean(this.state.pending)} text={this.state.pending} />

                <SequenceForm
                    ref='form'
                    {...this.state}
                    onChange={this.handleChange}
                    onSubmit={this.save}
                    onAutofill={this.autofill}
                    update={!adding}
                />

                {overlay}
            </ListGroupItem>
        );
    }
});

module.exports = ModifySequence;
