/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusEntry
 */

import React from "react";
import { Row, Col } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

/**
 * A form-based component used to filter the documents presented in JobsTable component.
 *
 * @class
 */
export default class VirusEntry extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            in: false
        };
    }

    static propTypes = {
        _id: React.PropTypes.string,
        name: React.PropTypes.string,
        abbreviation: React.PropTypes.string,
        modified: React.PropTypes.bool,
    };

    showDetail = () => {
        window.router.setExtra(["detail", this.props._id]);
    };

    archive = (event) => {
        event.stopPropagation();
        dispatcher.db.jobs.request("remove_job", {_id: this.props._id});
    };

    render () {

        let icon;

        if (this.props.modified) {
            icon = <Icon bsStyle="warning" style={{marginTop: "3px"}} name="flag" pullRight />;
        }

        return (
            <ListGroupItem bsStyle={this.props.modified ? "warning": null} className="spaced" onClick={this.showDetail}>
                <Row>
                    <Col md={6}>
                        <strong>{this.props.name}</strong>
                    </Col>
                    <Col md={6}>
                        {this.props.abbreviation}
                        {icon}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}
