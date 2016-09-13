/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports RemoveIsolateMethod
 */

'use strict';

var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Badge = require('react-bootstrap/lib/Badge');
var Modal = require('react-bootstrap/lib/Modal');
var Input = require('react-bootstrap/lib/InputGroup');
var Panel = require('react-bootstrap/lib/Panel');
var PanelGroup = require('react-bootstrap/lib/PanelGroup');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Utils = require('virtool/js/Utils');
var BaseSequence = require('./BaseSequence.jsx');

/**
 * A modal component that details the removed isolate and all of it's sequences.
 *
 * @class
 */
var MethodDetailModal = React.createClass({

    propTypes: {
        show: React.PropTypes.bool,
        onHide: React.PropTypes.func.isRequired,
        isolate: React.PropTypes.object.isRequired,
        message: React.PropTypes.element.isRequired
    },

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        // Each sequence is described by a readonly form, BaseSequence.
        var sequenceComponents = this.props.isolate.sequences.map(function (document) {
            return (
                <Panel key={document._id} header={document._id}>
                    <BaseSequence sequence={document} />
                </Panel>
            );
        });

        return (
            <Modal show={this.props.show} onHide={this.props.onHide} animation={false}>
                <Modal.Header>
                    {this.props.message}
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={6}>
                            <Input
                                type='text'
                                label='Source Type'
                                value={_.capitalize(this.props.isolate.source_type)}
                                readOnly
                            />
                        </Col>
                        <Col md={6}>
                            <Input
                                type='text'
                                label='Source Name'
                                value={this.props.isolate.source_name}
                                readOnly
                            />
                        </Col>
                    </Row>
                    <h5>
                        <Icon name='dna' /> <strong>Sequences </strong>
                        <Badge>{sequenceComponents.length}</Badge>
                    </h5>
                    <PanelGroup expanded={false} fill accordion defaultActiveKey={null}>
                        {sequenceComponents}
                    </PanelGroup>
                </Modal.Body>
            </Modal>
        )
    }

});

/**
 * Renders a decription of a remove_isolate change.
 *
 * @class
 */
var RemoveIsolateMethod = React.createClass({

    getInitialState: function () {
        // State determines whether a modal detailing the change should be shown.
        return {show: false};
    },

    /**
     * Shows the detail modal. Triggered by clicking the question icon.
     *
     * @func
     */
    showModal: function () {
        this.setState({show: true});
    },

    /**
     * Hides the detail modal. Triggered as the modal onHide prop.
     *
     * @func
     */
    hideModal: function () {
        this.setState({show: false});
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        // Only update if the modal is being toggled.
        return nextState.show !== this.state.show;
    },

    render: function () {
        // Get the part of the changes object that describes the change in the isolates.
        var fieldChange = _.find(this.props.changes, function (change) {
            return change[1] == 'isolates';
        });

        // Get the isolate from the change data.
        var isolate = fieldChange[2][0][1];

        // Parse out the isolate name from the isolate object.
        var isolateName = Utils.formatIsolateName(isolate);

        // Make a message describing the basics of the change which will be shown in the HistoryItem and the modal
        // title.
        var message = (
            <span>
                <Icon name='lab' bsStyle='danger' /> Removed isolate
                <em> {isolateName} ({isolate.isolate_id})</em>
            </span>
        );

        return (
            <span>
                <span>{message} </span>

                <Icon name='question' bsStyle='info' onClick={this.showModal} />

                <MethodDetailModal
                    show={this.state.show}
                    onHide={this.hideModal}
                    isolate={isolate}
                    message={message}
                />
            </span>
        );
    }

});

module.exports = RemoveIsolateMethod;