/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ConfirmModal
 */

'use strict';

var React = require('react');
var AlertModal = require('./AlertModal.jsx');
var Icon = require('./Icon.jsx');

/**
 * An extension of AlertModal which confirms actions being performed on one more target documents identified by _ids.
 * The action is provided to the component as a function (onAccept) that will be called when the accept button is
 * clicked.
 */
var ConfirmModal = React.createClass({

    propTypes: {
        show: React.PropTypes.bool.isRequired, // The modal is shown when set to `true`. Hidden when `false`.
        onHide: React.PropTypes.func.isRequired, // Called when the modal should be hidden (eg. click cancel)
        callback: React.PropTypes.func,
        targets: React.PropTypes.arrayOf(React.PropTypes.object),
        noun: React.PropTypes.string,
        nameKey: React.PropTypes.string
    },

    getDefaultProps: function () {
        return {
            noun: 'item',
            nameKey: 'name'
        };
    },

    onAccept: function () {
        this.props.callback(this.props.targets);
    },

    render: function () {

        var modalContent;
        var buttonContent;

        if (this.props.show) {
            var descriptor = "this";
            var noun = this.props.noun;

            if (this.props.targets.length !== 1) {
                noun += "s";
                descriptor = "these " + this.props.targets.length;
            }

            var listItems = this.props.targets.map(function (target) {
                return <li key={target._id}>{target[this.props.nameKey]} ({target._id})</li>
            }, this);

            modalContent = (
                <div>
                    <p>Are you sure you want to {this.props.operation} {descriptor} {noun}?</p>
                    <ul>{listItems}</ul>
                </div>
            );

            if (this.props.operation === "archive") buttonContent = <span><Icon name='box-add' /> Archive</span>;
            if (this.props.operation === "remove") buttonContent = <span><Icon name='remove'/> Remove</span>;
        }

        return (
            <AlertModal {...this.props} buttonContent={buttonContent} onAccept={this.onAccept}>
                {modalContent}
            </AlertModal>
        );
    }
});

module.exports = ConfirmModal;