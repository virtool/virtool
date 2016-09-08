/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SamplesImport
 *
 */

'use strict';

var _ = require("lodash");
var React = require('react');
var LinkedStateMixin = require('react-addons-linked-state-mixin');
var FlipMove = require("react-flip-move");

var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Alert = require('react-bootstrap/lib/Alert');
var Input = require('react-bootstrap/lib/Input');
var Panel = require('react-bootstrap/lib/Panel');
var Label = require('react-bootstrap/lib/Label');
var Modal = require('react-bootstrap/lib/Modal');
var Badge = require('react-bootstrap/lib/Badge');
var Button = require('react-bootstrap/lib/Button');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem =require('react-bootstrap/lib/ListGroupItem');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var InputError = require('virtool/js/components/Base/InputError.jsx');
var ReadSelector = require('./Reads.jsx');

/**
 * A main view for importing samples from FASTQ files. Importing starts an import job on the server.
 *
 * @class
 */
var SamplesImport = React.createClass({

    mixins: [LinkedStateMixin],

    propTypes: {
        show: React.PropTypes.bool.isRequired,
        onHide: React.PropTypes.func.isRequired
    },

    getInitialState: function () {
        var readyHosts = dispatcher.db.hosts.find({added: true});

        return {
            selected: [],

            name: '',
            host: '',
            isolate: '',
            locale: '',
            subtraction: readyHosts.length > 0 ? readyHosts[0]._id: null,

            forceGroupChoice: this.getForceGroupChoice(),
            group: dispatcher.settings.get('sample_group') == 'force_choice' ? 'none': '',

            nameExistsError: false,
            nameEmptyError: false,
            readError: false,

            pending: false,
            showCheck: false
        };
    },

    handleEntered: function () {
        this.refs.name.getInputDOMNode().focus();
        dispatcher.settings.on('change', this.onSettingsChange);
    },

    handleExit: function () {
        dispatcher.settings.off('change', this.onSettingsChange);
        this.setState(this.getInitialState());
    },

    onSettingsChange: function () {
        this.setState({forceGroupChoice: this.getForceGroupChoice ()});
    },

    getForceGroupChoice: function () {
        return dispatcher.settings.get('sample_group') == 'force_choice'
    },

    clear: function () {
        this.setState(this.getInitialState());
    },

    select: function (selected) {
        this.setState({
            selected: selected
        });
    },

    /**
     * Send a request to the server
     *
     * @param event {object} - the submit event
     */
    handleSubmit: function (event) {
        event.preventDefault();

        var data = _.pick(this.state, [
            "name",
            "host",
            "isolate",
            "locale",
            "subtraction",
            "group"
        ]);

        _.assign(data, {
            files: this.state.selected,
            paired: this.state.selected.length == 2
        });

        var nameEmptyError = !data.name;

        var nameExistsError = dispatcher.db.samples.count({name: data.name}) > 0;

        var readError = data.files.length === 0;

        if (readError || nameEmptyError || nameExistsError) {
            this.setState({
                readError: readError,
                nameEmptyError: nameEmptyError,
                nameExistsError: nameExistsError
            });
        } else {
            // Send the request to the server.
            this.setState({pending: true}, function () {
                dispatcher.db.samples.request('new', data).success(function () {
                    this.setState(_.extend(this.getInitialState(), {showCheck: true}), function () {
                        setTimeout(this.hideCheck, 400);
                    });
                }, this).failure(function () {
                    this.setState({
                        nameExistsError: true,
                        pending: false
                    });
                }, this);
            });
        }
    },

    hideCheck: function () {
        this.setState({showCheck: false});
    },

    render: function () {

        var modalBody;

        if (dispatcher.db.hosts.count({added: true}) === 0) {
            modalBody = (
                <Modal.Body>
                    <Alert bsStyle='warning' className='text-center'>
                        <Icon name='notification' />
                        <span> A host genome must be added to Virtool before samples can be created and analyzed.</span>
                    </Alert>
                </Modal.Body>
            );
        } else {

            var hostComponents = dispatcher.db.hosts.find({added: true}).map(function (host) {
                return <option key={host._id}>{host._id}</option>;
            });

            var userGroup;

            if (this.state.forceGroupChoice) {
                var userGroupComponents = dispatcher.user.groups.map(function (groupId) {
                    return <option key={groupId} value={groupId}>{_.capitalize(groupId)}</option>
                });

                userGroup = (
                    <Col md={3}>
                        <Input type='select' label='User Group' valueLink={this.linkState('group')}>
                            <option key='none' value='none'>None</option>
                            {userGroupComponents}
                        </Input>
                    </Col>
                );
            }

            var error;

            if (this.state.nameExistsError) {
                error = 'Sample name already exists. Choose another.'
            }

            if (this.state.nameEmptyError) {
                error = 'The name field cannot be empty.'
            }

            var pairedValue = this.state.selected.length === 2;

            var overlay;

            if (this.state.pending || this.state.showCheck) {
                overlay = (
                    <div ref="overlay" className="modal-body-overlay">
                        <span>
                            <Icon name="checkmark" pending={this.state.pending} />
                        </span>
                    </div>
                );
            }

            modalBody = (
                <form onSubmit={this.handleSubmit}>

                    <FlipMove enterAnimation="fade" leaveAnimation="fade" typeName="div" className="modal-body">

                        <Row ref="nameRow">
                            <Col md={9}>
                                <InputError
                                    ref='name'
                                    type='text'
                                    error={error ? <span className='text-danger'>{error}</span> : null}
                                    valueLink={this.linkState('name')}
                                    label='Sample Name'
                                    autoComplete='off'
                                />
                            </Col>
                            <Col md={3}>
                                <Input type='text' label='Isolate' valueLink={this.linkState('isolate')}/>
                            </Col>
                        </Row>

                        <Row ref="hostSubtractionRow">
                            <Col md={6}>
                                <Input type='text' label='True Host' valueLink={this.linkState('host')}/>
                            </Col>
                            <Col md={6}>
                                <Input type='select' label='Subtraction Host' valueLink={this.linkState('subtraction')}>
                                    {hostComponents}
                                </Input>
                            </Col>
                        </Row>

                        <Row ref="localeLibraryRow">
                            <Col md={this.state.forceGroupChoice ? 6 : 8}>
                                <Input type='text' label='Locale' valueLink={this.linkState('locale')}/>
                            </Col>
                            {userGroup}
                            <Col md={this.state.forceGroupChoice ? 3 : 4}>
                                <Input type='text' label='Library Type' value={pairedValue} readOnly/>
                            </Col>
                        </Row>

                        <ReadSelector
                            ref='reads'
                            {...this.state}
                            select={this.select}
                        />

                        {overlay}

                    </FlipMove>

                    <Modal.Footer>
                        <PushButton type='submit' bsStyle='primary'>
                            <Icon name='floppy' /> Save
                        </PushButton>
                    </Modal.Footer>
                </form>
            );
        }

        return (
            <Modal dialogClassName='modal-lg' {...this.props} onEntered={this.handleEntered} onExit={this.handleExit}>
                <Modal.Header {...this.props} closeButton>
                    Create Sample
                </Modal.Header>

                {modalBody}
            </Modal>
        );
    }
});

module.exports = SamplesImport;