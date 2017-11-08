/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports HMM
 */

import React from "react";
import URI from "urijs";
import { LinkContainer } from "react-router-bootstrap";
import { isEqual, keys, reject } from "lodash";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import {
    Alert,
    Badge,
    Col,
    FormControl,
    FormGroup,
    InputGroup,
    Label,
    ListGroup,
    Pagination,
    Row
} from "react-bootstrap";

import { findHMMs } from "../actions";
import { Button, Icon, ListGroupItem, PageHint } from "../../base"

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
class HMMList extends React.Component {

    componentDidMount () {
        this.props.onFind(this.props.location);
    }

    componentWillReceiveProps (nextProps) {
        if (!isEqual(nextProps.location, this.props.location)) {
            this.props.onFind(window.location.href);
        }
    }

    setTerm = (event) => {
        let uri = URI("/viruses/hmms").query({find: event.target.value || undefined});
        this.props.onSetURI(uri.toString());
    };

    setPage = (page) => {
        const uri = new URI(window.location.pathname + window.location.search);
        uri.setSearch({page: page});
        this.props.onSetURI(uri.toString());
    };

    render () {

        let errors;

        /*

        if (this.state.status.not_in_database.length > 0 && !alert) {
            const value = this.state.status.not_in_database;

            errors.push(
                <Alert key="not_in_database" bsStyle="danger">
                    <strong>
                        There {makeSpecifier(value.length, "profile")} in <code>profiles.hmm</code> that do not have
                        annotations in the database.
                    </strong>
                    &nbsp;
                    <span>
                        Ensure the annotation database and HMM file match by importing annotations or uploading a new
                        HMM file
                    </span>
                </Alert>
            )
        }

        if (this.state.status.not_in_file.length && !alert) {
            const value = this.state.status.not_in_file.length;

            errors.push(
                <Alert key="not_in_file" bsStyle="warning">
                    <Flex>
                        <FlexItem>
                            <strong>
                                There {makeSpecifier(value.length, "annotation")} in the database for which no
                                profiles exist in the HMM file.
                            </strong>
                            &nbsp;
                            <span>
                                Repairing this problem will remove extra annotations from the database.
                            </span>
                        </FlexItem>

                        <FlexItem grow={0} shrink={0} pad={30}>
                            <Button icon="hammer" onClick={this.clean}>
                                Repair
                            </Button>
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        */

        if (this.props.list === null) {
            return(
                <div className="text-center" style={{paddingTop: "130px"}}>
                    <ClipLoader color="#3c8786" />
                </div>
            );
        }

        let noFilePanel;

        if (!this.props.fileExists) {
            if (this.props.totalCount) {
                noFilePanel = (
                    <Alert bsStyle="warning" className="text-center">
                        <h5 className="text-warning">
                            <strong>
                                <Icon name="warning"/> No profile HMM file found.
                            </strong>
                        </h5>

                        <Button icon="download">
                            Download Official
                        </Button>
                    </Alert>
                );
            } else {
                noFilePanel = (
                    <Alert bsStyle="warning" className="text-center">
                        <h5 className="text-warning">
                            <strong>
                                <Icon name="warning"/> No profile HMM file or annotations found.
                            </strong>
                        </h5>

                        <Button icon="download">
                            Download Official
                        </Button>
                    </Alert>
                );
            }
        }

        let rowComponents = this.props.list.map(document => {
            const families = reject(keys(document.families), family => family === "None");

            const labelComponents = families.slice(0, 3).map((family, i) => (
                <span key={i}><Label>{family}</Label> </span>
            ));

            return (
                <LinkContainer key={document.id} to={`/viruses/hmms/${document.id}`}>
                    <ListGroupItem className="spaced">
                        <Row>
                            <Col xs={2}>
                                <strong>{document.cluster}</strong>
                            </Col>
                            <Col xs={5}>
                                {document.label}
                            </Col>
                            <Col xs={5}>
                                <div className="pull-right">
                                    {labelComponents} {families.length > 3 ? "..." : null}
                                </div>
                            </Col>
                        </Row>
                    </ListGroupItem>
                </LinkContainer>
            );
        });

        if (!rowComponents.length) {
            rowComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No profiles found
                </ListGroupItem>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>HMMs</strong> <Badge>{this.props.totalCount}</Badge>

                    <PageHint
                        count={this.props.list.length}
                        totalCount={this.props.totalCount}
                        page={this.props.page}
                        pullRight
                    />
                </h3>

                {noFilePanel}

                <FormGroup>
                    <InputGroup>
                        <InputGroup.Addon>
                            <Icon name="search" />
                        </InputGroup.Addon>

                        <FormControl
                            type="text"
                            placeholder="Definition, cluster, family"
                            onChange={this.setTerm}
                            value={this.props.term}
                        />
                    </InputGroup>
                </FormGroup>

                <ListGroup>
                    {rowComponents}
                </ListGroup>

                <div className="text-center">
                    <Pagination
                        items={this.props.pageCount}
                        maxButtons={10}
                        activePage={this.props.page}
                        onSelect={this.setPage}
                        first
                        last
                        next
                        prev
                    />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        ...state.hmms
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: (uri) => {
            dispatch(findHMMs(uri));
        },

        onSetURI: (uri) => {
            dispatch(push(uri));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMList);

export default Container;
