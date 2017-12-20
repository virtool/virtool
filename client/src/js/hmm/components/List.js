import React from "react";
import { LinkContainer } from "react-router-bootstrap";
import { keys, reject } from "lodash";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { Col, FormControl, FormGroup, InputGroup, Label, ListGroup, Row } from "react-bootstrap";

import HMMInstaller from "./Installer";
import { findHMMs } from "../actions";
import { Icon, ListGroupItem, LoadingPlaceholder, NoneFound, Pagination, ViewHeader } from "../../base";

const HMMItem = ({ cluster, families, id, names }) => {

    const filteredFamilies = reject(keys(families), family => family === "None");

    const labelComponents = filteredFamilies.slice(0, 3).map((family, i) =>
        <span key={i}><Label>{family}</Label> </span>
    );

    return (
        <LinkContainer to={`/hmm/${id}`}>
            <ListGroupItem className="spaced">
                <Row>
                    <Col xs={2}>
                        <strong>{cluster}</strong>
                    </Col>
                    <Col xs={5}>
                        {names[0]}
                    </Col>
                    <Col xs={5}>
                        <div className="pull-right">
                            {labelComponents} {filteredFamilies.length > 3 ? "..." : null}
                        </div>
                    </Col>
                </Row>
            </ListGroupItem>
        </LinkContainer>
    );
};

class HMMList extends React.Component {

    componentDidMount () {
        this.props.onFind();
    }

    setTerm = (event) => {
        const url = new window.URL(window.location);

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
            return <LoadingPlaceholder />;
        }

        let rowComponents;

        if (this.props.documents.length) {
            rowComponents = this.props.documents.map(document =>
                <HMMItem key={document.id} {...document} />
            );
        } else {
            rowComponents = <NoneFound noun="profiles" noListGroup />;
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

                {this.props.file_exists ? null : <HMMInstaller />}

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

                <Pagination
                    documentCount={this.props.documents.length}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    onPage={this.setPage}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({...state.hmms});

const mapDispatchToProps = (dispatch) => ({

    onFind: (url = new window.URL(window.location)) => {
        dispatch(push(url.pathname + url.search));
        dispatch(findHMMs());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMList);

export default Container;
