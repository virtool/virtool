import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup } from "react-bootstrap";

import CreateReference from "./Create";
import { ListGroupItem, Pagination, ViewHeader } from "../../base";
import { createFindURL } from "../../utils";

const ReferenceItem = ({ id, name }) => (
    <LinkContainer to={`/refs/${id}`} key={id} className="spaced">
        <ListGroupItem>
            {name}
        </ListGroupItem>
    </LinkContainer>
);

const ReferenceList = (props) => {

    if (props.documents === null) {
        return <div />;
    }

    const referenceComponents = map(props.documents, document =>
        <ReferenceItem key={document.id} {...document} />
    );

    return (
        <div>
            <ViewHeader
                title="References"
                page={props.page}
                count={2}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            <Link to={{state: {createReference: true}}}>
                Create
            </Link>

            <ListGroup>
                {referenceComponents}
            </ListGroup>

            <Pagination
                documentCount={2}
                onPage={props.onPage}
                page={props.page}
                pageCount={props.page_count}
            />

            <CreateReference />
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.references,
    account: state.account
});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceList);
