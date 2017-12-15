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
import { Col, FormControl, FormGroup, InputGroup, Label, ListGroup, Pagination, Row } from "react-bootstrap";

import { findHMMs } from "../actions";
import { Icon, ListGroupItem, ViewHeader } from "../../base"
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

        if (this.props.documents === null) {
            return(
                <div className="text-center" style={{paddingTop: "130px"}}>
                    <ClipLoader color="#3c8786" />
                </div>
            );
        }

        let rowComponents = this.props.documents.map(document => {
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
                <ViewHeader
                    title="HMMs"
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
                />

                {this.props.file_exists ? null: <HMMInstaller />}

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
                        items={this.props.page_count}
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
    return {...state.hmms};
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
