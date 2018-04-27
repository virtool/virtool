import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { push } from "react-router-redux";

import CreateReference from "./Create";
import { Pagination, ViewHeader, Flex } from "../../base";
import { createFindURL } from "../../utils";
import ReferenceItem from "./ReferenceItem";

const ReferenceContainer = ({ references }) => (
    <Flex direction="row" wrap="wrap" justifyContent="space-around">
        {references}
    </Flex>
);

const ReferenceList = (props) => {

    if (props.documents === null) {
        return <div />;
    }
/*
    const referenceComponents = map(props.documents, document =>
        <ReferenceItem key={document.id} {...document} />
    );
*/
    const testDocuments = [
        { id: "test1", name: "FIRST REFERENCE", content: "metadata1" },
        { id: "test2", name: "SECOND REFERENCE", content: "metadata2" },
        { id: "test3", name: "THIRD REFERENCE", content: "metadata3" }
    ];
    const referenceComponents = map(testDocuments, document =>
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

            <ReferenceContainer references={referenceComponents} />

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
