/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import URI from "urijs";
import { connect } from "react-redux";
import { Link, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Badge, Row, Col, ListGroup, Pagination } from "react-bootstrap";

import { findViruses } from "../actions";
import { Flex, FlexItem, Icon, ListGroupItem } from "virtool/js/components/Base";
import VirusToolbar from "./Toolbar";
import CreateVirus from "./Create";

class VirusesList extends React.Component {

    constructor (props) {
        super(props)
    }

    static propTypes = {
        history: PropTypes.object,
        location: PropTypes.object,
        account: PropTypes.object,
        page: PropTypes.number,
        pageCount: PropTypes.number,
        totalCount: PropTypes.number,
        foundCount: PropTypes.number,
        documents: PropTypes.arrayOf(React.PropTypes.object),
        modifiedCount: PropTypes.number,
        onFind: PropTypes.func
    };

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

        this.props.history.push(uri.toString());
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
                            <Col xs={12} md={6}>
                                <strong>{document.name}</strong>
                            </Col>
                            <Col xs={12} md={6}>
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

        const first = 1 + (this.props.page - 1) * 15;
        const last = first + (virusCount < 15 ? virusCount - 1: 14);

        return (
            <div>
                <h3 className="view-header">
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>
                                Viruses <Badge>{this.props.totalCount}</Badge>
                            </strong>
                        </FlexItem>

                        <span className="text-muted pull-right" style={{fontSize: "12px"}}>
                            Viewing {first} - {last} of {this.props.foundCount}
                        </span>
                    </Flex>
                </h3>

                {alert}

                <VirusToolbar
                    canModify={this.props.account.permissions.modify_virus}
                    onChangeTerm={this.handleChangeTerm}
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
        }
    };
};

const Container = connect(
    mapStateToProps,
    mapDispatchToProps
)(VirusesList);

export default Container;
