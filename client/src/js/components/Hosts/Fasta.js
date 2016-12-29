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

import React from "react";
import Numeral from "numeral";
import { Row, Col } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

/**
 * A component that represents a host FASTA file document. Presents descriptive data for the file and an "add" button
 * that triggers opening of an add modal form when clicked.
 */
export default class HostFasta extends React.Component {

    static propTypes = {
        _id: React.PropTypes.string,
        name: React.PropTypes.string,
        size: React.PropTypes.number
    };

    /**
     * Opens an add modal form for the host file. The file "_id" and "size" are passed to the new modal.
     *
     * @func
     */
    add = () => {
        dispatcher.router.setExtra(["add", this.props._id]);
    };

    render () {
        return (
            <ListGroupItem className="disable-select" onClick={this.add}>
                <Row>
                    <Col sm={8}>
                        <Icon name="file"/> {this.props.name}
                    </Col>
                    <Col sm={4}>{Numeral(this.props.size).format("0.0 b")}</Col>
                </Row>
            </ListGroupItem>
        );
    }
}
