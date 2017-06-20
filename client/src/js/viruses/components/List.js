/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { connect } from "react-redux";
import { Link, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Alert, ListGroup } from "react-bootstrap";

import { findViruses } from "../actions";
import { Flex, FlexItem, Icon, ListGroupItem } from "virtool/js/components/Base";
import VirusToolbar from "./Toolbar";
import CreateVirus from "./Create";

class VirusesList extends React.Component {

    constructor (props) {
        super(props)
    }

    static propTypes = {
        documents: React.PropTypes.arrayOf(React.PropTypes.object),
        onFind: React.PropTypes.func
    };

    componentDidMount () {
        if (this.props.documents === null) {
            this.props.onFind(null);
        }
    }

    render () {

        let virusComponents;

        if (this.props.documents && this.props.documents.length > 0) {
            virusComponents = this.props.documents.map(document =>
                <LinkContainer to={`/viruses/${document.virus_id}`} key={document.virus_id} className="spaced">
                    <ListGroupItem bsStyle={document.modified ? "warning": null}>
                        <Row>
                            <Col sm={12} md={6}>
                                <strong>{document.name}</strong>
                            </Col>
                            <Col sm={12} md={6}>
                                {document.abbreviation}
                                <span className="pull-right">
                                    {document.modified ? <Icon bsStyle="warning" name="flag" />: null}
                                </span>
                            </Col>
                        </Row>
                    </ListGroupItem>
                </LinkContainer>
            );
        } else {
            virusComponents = (
                <ListGroupItem key="noViruses" className="text-center">
                    <Icon name="info"/> No viruses found.
                </ListGroupItem>
            );
        }

        let alert;

        if (this.props.modifiedCount) {
            alert = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="info" />
                        <FlexItem pad={5}>
                            <span>The virus database has changed. </span>
                            <Link to="/viruses/indexes">Rebuild the index</Link>
                            <span> to use the changes in further analyses.</span>
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>
                        Viruses
                    </strong>
                </h3>

                {alert}

                <VirusToolbar {...this.props} />

                <ListGroup>
                    {virusComponents}
                </ListGroup>

                <Route path="/viruses/create">
                    <CreateVirus {...this.props} />
                </Route>
            </div>
        );

    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.viruses.documents,
        finding: state.viruses.finding,
        find: state.viruses.find,
        sort: state.viruses.sort,
        descending: state.viruses.descending,
        modified: state.viruses.modified,
        modifiedCount: state.viruses.modifiedCount,
        account: state.account
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        onFind: (term) => {
            dispatch(findViruses({find: term || null}));
        },

        onToggleModifiedOnly: () => {
            dispatch(findViruses({modified: !ownProps.modified}));
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(VirusesList);

export default Container;
