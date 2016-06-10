/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Body
 */

'use strict';

var React = require('react');
var Row = require('./Row.jsx');

/**
 * The table body component of the DynamicTable.
 */
var Body = React.createClass({

    propTypes: {
        documents: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
        onSelect: React.PropTypes.func
    },

    render: function () {

        var rowComponents = this.props.documents.map(function (document) {
            // Bind the onClick prop of the Body component to the onClick event for each table row.
            var onClick = function () {
                this.props.onClick(document);
            }.bind(this);

            var datumComponents = this.props.fields.map(function (field) {
                return (
                    <td key={document._id + '.' + field.key} onClick={onClick}>
                        {field.hasOwnProperty('render') ? field.render(document): document[field.key]}
                    </td>
                );
            }, this);

            var actions;

            // Show some action buttons if the createActions function is defined.
            if (this.props.createActions) {
                actions = (
                    <td className='cell-fit pointer'>
                        {this.props.createActions(document)}
                    </td>
                );
            }

            var selected = this.props.selected.indexOf(document._id) !== -1;

            return (
                <Row key={document._id} _id={document._id} selected={selected} onSelect={this.props.onSelect}>
                    {datumComponents}
                    {actions}
                </Row>
            );

        }, this);

        return (
            <tbody>
                {rowComponents}
            </tbody>
        );
    }
});

module.exports = Body;