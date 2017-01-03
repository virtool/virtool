/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports IndexEntry
 */


import React from "react";
import { Row, Col, Label } from "react-bootstrap";
import { Icon, RelativeTime, ListGroupItem } from "virtool/js/components/Base";

export default class IndexEntry extends React.PureComponent {
    
    static propTypes = {
        ready: React.PropTypes.bool,
        showReady: React.PropTypes.bool,
        timestamp: React.PropTypes.string,
        index_version: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),
        modification_count: React.PropTypes.number,
        modified_virus_count: React.PropTypes.number
    };

    render () {

        let ready;

        // Decide what icon/text should be shown at the right end of the index document. If the index is building a
        // spinner with "Building" is shown, if the index is the active index a green check is shown. Otherwise, no
        // content is shown at the right.
        if (this.props.showReady) {
            ready = (
                <span className="pull-right">
                    <Icon name="checkmark" bsStyle="success" pending={!this.props.ready} />
                    <span> {this.props.ready ? "Active": "Building"}</span>
                </span>
            );
        }

        // The description of
        let changeDescription;

        if (this.props.modification_count !== null) {
            // Text to show if no changes occurred since the last index build. Technically, should never be shown
            // because the rebuild button is not shown if no changes have been made.
            changeDescription = "No changes";

            // This should always test true in practice. Shows the number of changes and the number of viruses
            // affected.
            if (this.props.modification_count > 0) {
               changeDescription = (
                    <span>
                        {this.props.modification_count} changes made in {this.props.modified_virus_count} viruses
                    </span>
                );
            }
        }

        return (
            <ListGroupItem>
                <Row>
                    <Col md={3}><Label>Version {this.props.index_version}</Label></Col>
                    <Col md={3}>Created <RelativeTime time={this.props.timestamp} /></Col>
                    <Col md={4}>{changeDescription}</Col>
                    <Col md={2}>{ready}</Col>
                </Row>
            </ListGroupItem>
        );
    }

}
