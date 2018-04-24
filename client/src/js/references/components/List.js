import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup } from "react-bootstrap";

import { ListGroupItem, Pagination, ViewHeader } from "../../base";
import { createFindURL } from "../../utils";

const RefItem = ({ id, name }) => (
    <LinkContainer to={`/refs/${id}`} key={id} className="spaced">
        <ListGroupItem>
            {name}
        </ListGroupItem>
    </LinkContainer>
);

const RefList = (props) => {

    if (props.documents === null) {
        return <div />;
    }

    const virusCount = 2;

    const refComponents = map(props.documents, document => <RefItem key={document.id} {...document} />);

    return (
        <div>
            <ViewHeader
                title="Refs"
                page={props.page}
                count={2}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            <ListGroup>
                {refComponents}
            </ListGroup>

            <Pagination
                documentCount={2}
                onPage={props.onPage}
                page={props.page}
                pageCount={props.page_count}
            />
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.refs,
    account: state.account
});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(RefList);
