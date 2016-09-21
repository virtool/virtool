/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UpdateSequenceMethod
 */

var _ = require('lodash');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Modal = require('react-bootstrap/lib/Modal');
var Badge = require('react-bootstrap/lib/Badge');
var ListGroup = require('react-bootstrap/lib/ListGroup');
var ListGroupItem = require('react-bootstrap/lib/ListGroupItem');

var Utils = require('virtool/js/Utils');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Input = require('virtool/js/components/Base/Input.jsx');

/**
 * Describes a change in a single field of a sequence record. Shows the value before the change, an arrow, and the
 * value after the change.
 *
 * @class
 */
var Change = React.createClass({

    shouldComponentUpdate: function () {
        return false;
    },

    render: function () {
        // The capitalized name of the field affected the change.
        var fieldName = _.capitalize(this.props.change[1][4]);

        // The values before the change and after.
        var oldValue = this.props.change[2][0];
        var newValue = this.props.change[2][1];

        // Props that are the same for the before and after input fields.
        var sharedProps = {
            type: fieldName === 'Sequence' ? 'textarea': 'text',
            rows: fieldName === 'Sequence' ? 5: null,
            readOnly: true
        };

        return (
            <ListGroupItem>
                <Input
                    {...sharedProps}
                    label={fieldName}
                    value={oldValue}
                />

                <div className='text-center' style={{marginBottom: '15px'}}>
                    <Icon name='arrow-down' />
                </div>

                <Input
                    {...sharedProps}
                    value={newValue}
                />
            </ListGroupItem>
        );
    }
});

/**
 * A text element briefly describing changes made by update_sequence. A modal can be opened containing further detail.
 *
 * @class
 */
var UpdateSequenceMethod = React.createClass({

    getInitialState: function () {
        return {show: false};
    },

    shouldComponentUpdate: function (nextProps, nextState) {
        return this.state.show !== nextState;
    },

    /**
     * Change state to make the history detail modal appear. Triggered by clicking the question mark icon.
     *
     * @func
     */
    showModal: function () {
        this.setState({show: true});
    },

    /**
     * Change state to hide the history detail modal. Called as the onHide prop for the Modal component.
     *
     * @func
     */
    hideModal: function () {
        this.setState({show: false});
    },

    render: function () {
        // Get a the change description tuples from props.
        var changes = _.filter(this.props.changes, function (change) {
            return change[1] !== '_version' && change[1] !== 'modified';
        });

        // Construct a Change component for each change tuple.
        var changeComponents = changes.map(function (change, index) {
            return <Change key={index} change={change} number={index + 1} />;
        });

        var isolateName = Utils.formatIsolateName(this.props.annotation);

        // A message that will describe the change in the HistoryItem component and serve as the title for the detail
        // modal.
        var message = (
            <span>
                <Icon name='dna' bsStyle='warning' /> Updated sequence {this.props.annotation._id} in
                <em> {isolateName} ({this.props.annotation.isolate_id}) </em>
            </span>
        );

        return (
            <span>
                {message} <Icon name='question' bsStyle='info' onClick={this.showModal} />

                <Modal show={this.state.show} onHide={this.hideModal} animation={false}>
                    <Modal.Header>
                        <Modal.Title>
                            {message}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <ListGroup fill>
                            {changeComponents}
                        </ListGroup>
                    </Modal.Body>
                </Modal>
            </span>
        );
    }
});

module.exports = UpdateSequenceMethod;