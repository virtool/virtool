/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import URI from "urijs";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Badge, Row, Col, ListGroup, Pagination } from "react-bootstrap";

import { findViruses } from "../actions";
import { Flex, FlexItem, Icon, ListGroupItem, PageHint } from "../../base";
import VirusToolbar from "./Toolbar";
import CreateVirus from "./Create";

class VirusesList extends React.Component {

    constructor (props) {
        super(props)
    }

    componentDidMount () {
        this.props.onFind(this.props.location);
    }

    componentDidUpdate (prevProps) {
        if (prevProps.location !== this.props.location) {
            this.props.onFind(this.props.location);
        }
    }

    handleChangeTerm = (term) => {
        const uri = new URI(this.props.location.pathname + this.props.location.search);

        if (term) {
            uri.setSearch({find: term});
        } else {
            uri.removeSearch("find");
        }
        
        this.props.history.push(uri);
    };

    handlePage = (page) => {
        const uri = new URI(this.props.location.pathname + this.props.location.search);
        uri.setSearch({page: page});

        this.props.history.push(uri.toString());
    };

    render () {

        let virusComponents;

        if (this.props.documents === null) {
            return <div />;
        }

        const virusCount = this.props.documents.length;

        if (virusCount > 0) {
            virusComponents = this.props.documents.map(document =>
                <LinkContainer to={`/viruses/${document.id}`} key={document.id} className="spaced">
                    <ListGroupItem bsStyle={document.verified ? null: "warning"}>
                        <Row>
                            <Col xs={11} md={7}>
                                <strong>{document.name}</strong>
                                <small className="hidden-md hidden-lg text-muted" style={{marginLeft: "5px"}}>
                                    {document.abbreviation}
                                </small>
                            </Col>
                            <Col xsHidden md={4}>
                                {document.abbreviation}
                            </Col>
                            <Col xs={1} md={1}>
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
                    <span>
                        <Icon name="info"/> No viruses found. <Link to={{state: {virusImport: true}}}>Import</Link> or
                    </span>
                    <span> <Link to={{state: {createVirus: true}}}>Create</Link> some</span>
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
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                Viruses <Badge>{this.props.totalCount}</Badge>
                            </strong>
                        </FlexItem>

                        <PageHint
                            count={virusCount}
                            totalCount={this.props.totalCount}
                            page={this.props.page}
                            pullRight
                        />
                    </Flex>
                </h3>

                {alert}

                <VirusToolbar
                    canModify={this.props.account.permissions.modify_virus}
                    onChangeTerm={this.handleChangeTerm}
                    location={this.props.location}
                />

                <ListGroup>
                    {virusComponents}
                </ListGroup>

                <div className="text-center">
                    <Pagination
                        items={this.props.pageCount}
                        maxButtons={10}
                        activePage={this.props.page}
                        onSelect={this.handlePage}
                        first
                        last
                        next
                        prev
                    />
                </div>

                <Route children={({ location }) => {
                    return <CreateVirus {...this.props} show={!!location.state && location.state.createVirus} />;
                }} />
            </div>
        );

    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.viruses.documents,
        modified: state.viruses.modified,
        page: state.viruses.page,
        pageCount: state.viruses.pageCount,
        totalCount: state.viruses.totalCount,
        foundCount: state.viruses.foundCount,
        modifiedCount: state.viruses.modifiedCount,
        account: state.account
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        onFind: (location) => {
            const uri = new URI(location.search);
            const query = uri.search(true);

            dispatch(findViruses(query.find, query.page));
        },

        onToggleModifiedOnly: () => {
            dispatch(findViruses({modified: !ownProps.modified}));
        },

        onHide: () => {
            dispatch(push({state: {createVirus: false}}));
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(VirusesList);

export default Container;
