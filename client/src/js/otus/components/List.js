import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Row, Col, ListGroup } from "react-bootstrap";

import { Flex, FlexItem, Icon, ListGroupItem, Pagination, ViewHeader } from "../../base";
import OTUToolbar from "./Toolbar";
import CreateOTU from "./Create";
import OTUImport from "./Import";
import { createFindURL } from "../../utils";

const OTUItem = ({ abbreviation, id, name, modified, verified }) => (
    <LinkContainer to={`/OTUs/${id}`} key={id} className="spaced">
        <ListGroupItem bsStyle={verified ? null : "warning"}>
            <Row>
                <Col xs={11} md={7}>
                    <strong>{name}</strong>
                    <small className="hidden-md hidden-lg text-muted" style={{marginLeft: "5px"}}>
                        {abbreviation}
                    </small>
                </Col>
                <Col xsHidden md={4}>
                    {abbreviation}
                </Col>
                <Col xs={1} md={1}>
                    <span className="pull-right">
                        {modified ? <Icon bsStyle="warning" name="flag" /> : null}
                    </span>
                </Col>
                {verified ? null : <Icon name="tag" pullRight tip="This OTU is unverified" />}
            </Row>
        </ListGroupItem>
    </LinkContainer>
);

const OTUsList = (props) => {

    let OTUComponents;

    if (props.documents === null) {
        return <div />;
    }

    const OTUCount = props.documents.length;

    if (OTUCount) {
        OTUComponents = map(props.documents, document => <OTUItem key={document.id} {...document} />);
    } else {
        OTUComponents = (
            <ListGroupItem key="noOTUs" className="text-center">
                <span>
                    <Icon name="info" /> No OTUs found. <Link to={{state: {OTUImport: true}}}>Import</Link> or
                </span>
                <span> <Link to={{state: {createOTU: true}}}>Create</Link> some</span>
            </ListGroupItem>
        );
    }

    let alert;

    if (props.modified_count) {
        alert = (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="info" />
                    <FlexItem pad={5}>
                        <span>The OTU database has changed. </span>
                        <Link to="/OTUs/indexes">Rebuild the index</Link>
                        <span> to use the changes in further analyses.</span>
                    </FlexItem>
                </Flex>
            </Alert>
        );
    }

    return (
        <div>
            <ViewHeader
                title="OTUs"
                page={props.page}
                count={OTUCount}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            {alert}

            <OTUToolbar />

            <ListGroup>
                {OTUComponents}
            </ListGroup>

            <Pagination
                documentCount={OTUCount}
                onPage={props.onPage}
                page={props.page}
                pageCount={props.page_count}
            />

            <CreateOTU {...props} />

            <OTUImport />
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.OTUs,
    account: state.account
});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    },

    onHide: () => {
        dispatch(push({state: {createOTU: false}}));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUsList);
