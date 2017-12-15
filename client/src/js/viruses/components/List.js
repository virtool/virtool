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
import { push } from "react-router-redux";
import { Link, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Row, Col, ListGroup, Pagination } from "react-bootstrap";

import { findViruses } from "../actions";
import { Flex, FlexItem, Icon, ListGroupItem, ViewHeader } from "../../base";
import VirusToolbar from "./Toolbar";
import CreateVirus from "./Create";

class VirusesList extends React.Component {

    constructor (props) {
        super(props)
    }

    componentDidMount () {
        this.props.onFind();
    }

    handleChangeTerm = (term) => {
        const url = new window.URL(window.location);

        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find");
        }

        this.props.onFind(url);
    };

    handlePage = (page) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
        this.props.onFind(url);
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
                <ViewHeader
                    title="Samples"
                    page={this.props.page}
                    count={virusCount}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

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
        onFind: (url = new window.URL(window.location)) => {
            dispatch(push(url.pathname + url.search));
            dispatch(findViruses(url.searchParams.get("find"), url.searchParams.get("page") || 1));
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
