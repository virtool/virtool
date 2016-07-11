/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostFasta
 */

'use strict';

var _ = require('lodash');
var Numeral = require('numeral');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');

var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');

/**
 * A component that represents a host FASTA file document. Presents descriptive data for the file and an 'add' button that
 * triggers opening of an add modal form when clicked.
 */
var HostFasta = React.createClass({

    /**
     * Opens an add modal form for the host file. The file '_id' and 'size' are passed to the new modal.
     *
     * @func
     */
    add: function () {
        dispatcher.router.setExtra(["add", this.props._id]);
    },

    render: function () {
        return (
            <ListGroupItem className='disable-select' onClick={this.add}>
                <Row>
                    <Col sm={4}>
                        <Icon name='file'/> {this.props._id}
                    </Col>
                    <Col sm={2}>{Numeral(this.props.size).format('0.0 b')}</Col>
                    <Col sm={6}>
                        <span className='pull-right'>
                            Last modified <RelativeTime time={this.props.modify} />
                        </span>
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
});

module.exports = HostFasta;