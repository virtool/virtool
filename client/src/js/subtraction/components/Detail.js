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

import React from "react";
import Numeral from "numeral";
import { toScientificNotation } from "virtool/js/utils";
import { Modal, Table, Alert } from "react-bootstrap";
import { Icon, ConfirmFooter } from "virtool/js/components/Base";

export class HostDetailFooter extends React.Component {

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        onError: React.PropTypes.func
    };

    /**
     * Remove the host associated with the host id. Triggered by clicking the confirm button in the active
     * ConfirmFooter.
     *
     * @func
     */
    remove = () => {
        dispatcher.db.hosts.request("remove_host", {_id: this.props._id})
            .failure(this.props.onError);
    };

    render () {

        const buttonContent = (
            <span>
                <Icon name="remove"/> Remove
            </span>
        );

        return (
            <ConfirmFooter
                {...this.props}
                callback={this.remove}
                buttonContent={buttonContent}
                closeOnConfirm={false}
                message="Do you really want to delete this host?"
            />
        );
    }
}

export default class HostDetail extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            error: false
        };
    }

    static propTypes = {
        detail: React.PropTypes.object,
        onHide: React.PropTypes.func
    };

    showError = () => {
        this.setState({
            error: true
        });
    };

    render () {

        const data = this.props.detail;
        const nucs = data.nucleotides;
        const gc = Numeral(1 - nucs.a - nucs.t - nucs.n).format("0.000");

        let alert;
        let footer;

        if (this.state.error) {
            alert = (
                <Alert bsStyle="danger">
                    <Icon name="warning" /> Host could not be removed because it is referenced by at least one sample.
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
                        <strong><Icon name="tag" /> General</strong>
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
                        <strong><Icon name="ruler" /> Length Distribution</strong>
                    </h5>
                    <Table condensed bordered>
                        <tbody>
                            <tr>
                                <th className="col-sm-3">Mean</th>
                                <td>{toScientificNotation(data.lengths.mean)}</td>
                            </tr>
                            <tr>
                                <th>Max</th>
                                <td>{toScientificNotation(data.lengths.max)}</td>
                            </tr>
                            <tr>
                                <th>Min</th>
                                <td>{toScientificNotation(data.lengths.min)}</td>
                            </tr>
                            <tr>
                                <th>Total</th>
                                <td>{toScientificNotation(data.lengths.total)}</td>
                            </tr>
                        </tbody>
                    </Table>

                    {alert}
                </Modal.Body>
                {footer}
            </div>
        )
    }

}
