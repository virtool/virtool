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
import { Icon, ListGroupItem, PageHint } from "../../base"
import HMMInstaller from "./Installer";

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
        if (!isEqual(nextProps.location, this.props.location) || (nextProps.ready && !this.props.ready)) {
            this.props.onFind(window.location.href);
        }
    }

    setTerm = (event) => {
        let uri = URI("/hmm").query({find: event.target.value || undefined});
        this.props.onSetURI(uri.toString());
    };

    setPage = (page) => {
        const uri = new URI(window.location.pathname + window.location.search);
        uri.setSearch({page: page});
        this.props.onSetURI(uri.toString());
    };

    render () {

        if (this.props.list === null) {
            return(
                <div className="text-center" style={{paddingTop: "130px"}}>
                    <ClipLoader color="#3c8786" />
                </div>
            );
        }

        let installer;

        if (!this.props.fileExists) {
            installer = <HMMInstaller />;
        }

        let rowComponents = this.props.list.map(document => {
            const families = reject(keys(document.families), family => family === "None");

            const labelComponents = families.slice(0, 3).map((family, i) => (
                <span key={i}><Label>{family}</Label> </span>
            ));

            return (
                <LinkContainer key={document.id} to={`/hmm/${document.id}`}>
                    <ListGroupItem className="spaced">
                        <Row>
                            <Col xs={2}>
                                <strong>{document.cluster}</strong>
                            </Col>
                            <Col xs={5}>
                                {document.names[0]}
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

                {installer}

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
