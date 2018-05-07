import React from "react";
import PropTypes from "prop-types";
import { ClipLoader } from "halogenium";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Label } from "react-bootstrap";
import { Icon, RelativeTime, ListGroupItem } from "../../base";

export default class IndexEntry extends React.PureComponent {

    static propTypes = {
        ready: PropTypes.bool,
        showReady: PropTypes.bool,
        created_at: PropTypes.string,
        version: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        modification_count: PropTypes.number,
        modified_otu_count: PropTypes.number
    };

    render () {

        let ready;

        // Decide what icon/text should be shown at the right end of the index document. If the index is building a
        // spinner with "Building" is shown, if the index is the active index a green check is shown. Otherwise, no
        // content is shown at the right.
        if (this.props.showReady) {
            if (this.props.ready) {
                ready = (
                    <span className="pull-right">
                        <Icon name="checkmark" bsStyle="success" /> <strong>Active</strong>
                    </span>
                );
            } else {
                ready = (
                    <div className="pull-right" >
                        <ClipLoader size="14px" color="#3c8786" style={{display: "inline"}} />
                        <strong> Building</strong>
                    </div>
                );
            }
        }

        // The description of
        let changeDescription;

        if (this.props.modification_count !== null) {
            // Text to show if no changes occurred since the last index build. Technically, should never be shown
            // because the rebuild button is not shown if no changes have been made.
            changeDescription = "No changes";

            // This should always test true in practice. Shows the number of changes and the number of OTUs
            // affected.
            if (this.props.modification_count > 0) {
                changeDescription = (
                    <span>
                        {this.props.modification_count} changes made in {this.props.modified_otu_count} OTUs
                    </span>
                );
            }
        }

        return (
            <LinkContainer to={`/otus/indexes/${this.props.version}`} className="spaced">
                <ListGroupItem>
                    <Row>
                        <Col md={3}>
                            <Label>
                                Version {this.props.version}
                            </Label>
                        </Col>
                        <Col md={3}>
                            Created <RelativeTime time={this.props.created_at} />
                        </Col>
                        <Col md={4}>
                            {changeDescription}
                        </Col>
                        <Col md={2}>
                            {ready}
                        </Col>
                    </Row>
                </ListGroupItem>
            </LinkContainer>
        );
    }
}
