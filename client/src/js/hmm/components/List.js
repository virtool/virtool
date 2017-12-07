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
import { LinkContainer } from "react-router-bootstrap";
import { keys, reject } from "lodash";
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
import { Icon, Flex, FlexItem, ListGroupItem, PageHint } from "../../base"
import HMMInstaller from "./Installer";

/**
 * A main component that shows a history of all index builds and the changes that comprised them.
 *
 * @class
 */
class HMMList extends React.Component {

    componentDidMount () {
        this.props.onFind();
    }

    setTerm = (event) => {
        let url = new window.URL(window.location);

        if (event.target.value) {
            url.searchParams.set("find", event.target.value);
        } else {
            url.searchParams.delete("find");
        }

        this.props.onFind(url);
    };

    setPage = (page) => {
        const url = new window.URL(window.location);
        url.searchParams.set("page", page);
        this.props.onFind(url);
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
                    <Flex alignItems="flex-end">
                        <FlexItem grow={0} shrink={0}>
                            <strong>HMMs</strong> <Badge>{this.props.totalCount}</Badge>
                        </FlexItem>
                        <FlexItem grow={1} shrink={0}>
                            <PageHint
                                count={this.props.list.length}
                                totalCount={this.props.totalCount}
                                page={this.props.page}
                                pullRight
                            />
                        </FlexItem>
                    </Flex>
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
        onFind: (url = new window.URL(window.location)) => {
            dispatch(push(url.pathname + url.search));
            dispatch(findHMMs(url.searchParams.get("find"), url.searchParams.get("page") || 1));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMList);

export default Container;
