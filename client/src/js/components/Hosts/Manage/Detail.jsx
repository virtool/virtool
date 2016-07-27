/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HostDetail
 */

'use strict';

var React = require('react');
var Table = require('react-bootstrap/lib/Table');
var Alert = require('react-bootstrap/lib/Alert');
var Modal = require('react-bootstrap/lib/Modal');
var Button = require('react-bootstrap/lib/Button');
var Numeral = require('numeral');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var ConfirmFooter = require('virtool/js/components/Base/ConfirmFooter.jsx');
var Utils = require('virtool/js/Utils');


/**
 * The ConfirmFooter component for the host detail modal.
 *
 * @class
 */
var HostDetailFooter = React.createClass({

    /**
     * Remove the host associated with the host id. Triggered by clicking the confirm button in the active
     * ConfirmFooter.
     *
     * @func
     */
    remove: function () {
        dispatcher.db.hosts.request('remove_host', {_id: this.props._id}, null, this.props.onError);
    },

    render: function () {

        var buttonContent = (
            <span>
                <Icon name='remove'/> Remove
            </span>
        );

        return (
            <ConfirmFooter
                {...this.props}
                callback={this.remove}
                buttonContent={buttonContent}
                closeOnConfirm={false}
                message='Do you really want to delete this host?'
            />
        );
    }
});

/**
 * A modal component for showing the details for a host document. Has a ConfirmFooter for removing the host.
 *
 * @class
 */
var HostDetail = React.createClass({

    getInitialState: function () {
        return {
            error: false
        };
    },

    showError: function () {
        this.setState({error: true});
    },

    render: function () {

        var data = this.props.detail;
        var nucs = data.nucleotides;
        var gc = Numeral(1 - nucs.a - nucs.t - nucs.n).format('0.000');

        var alert;
        var footer;

        if (this.state.error) {
            alert = (
                <Alert bsStyle='danger'>
                    <Icon name='warning' /> Host could not be removed because it is referenced by at least one sample.
                </Alert>
            );
        }
        
        if (dispatcher.user.permissions.remove_host && !this.state.error) {
            footer = (
                <HostDetailFooter
                    onHide={this.props.onHide}
                    onError={this.showError}
                    error={this.state.error}
                    {...data}
                />
            );
        }

        return (
            <div>
                <Modal.Header onHide={this.props.onHide} closeButton>
                    Host Detail
                </Modal.Header>
                <Modal.Body>
                    <h5>
                        <strong><Icon name='tag' /> General</strong>
                    </h5>
                    <Table condensed bordered>
                        <tbody>
                            <tr>
                                <th className="col-sm-3">Organism</th>
                                <td><em>{data._id}</em></td>
                            </tr>

                            <tr>
                                <th>Description</th>
                                <td>{data.description}</td>
                            </tr>

                            <tr>
                                <th>File</th>
                                <td>{data.file}</td>
                            </tr>

                            <tr>
                                <th>GC Estimate</th>
                                <td>{gc}</td>
                            </tr>
                        </tbody>
                    </Table>

                    <h5>
                        <strong><Icon name='ruler' /> Length Distribution</strong>
                    </h5>
                    <Table condensed bordered>
                        <tbody>
                            <tr>
                                <th className="col-sm-3">Mean</th>
                                <td>{Utils.toScientificNotation(data.lengths.mean)}</td>
                            </tr>
                            <tr>
                                <th>Max</th>
                                <td>{Utils.toScientificNotation(data.lengths.max)}</td>
                            </tr>
                            <tr>
                                <th>Min</th>
                                <td>{Utils.toScientificNotation(data.lengths.min)}</td>
                            </tr>
                            <tr>
                                <th>Total</th>
                                <td>{Utils.toScientificNotation(data.lengths.total)}</td>
                            </tr>
                        </tbody>
                    </Table>

                    {alert}
                </Modal.Body>
                {footer}
            </div>
        )
    }

});

module.exports = HostDetail;