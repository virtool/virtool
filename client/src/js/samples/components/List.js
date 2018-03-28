import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { ListGroup } from "react-bootstrap";

import SampleEntry from "./Entry";
import SampleToolbar from "./Toolbar";
import CreateSample from "./Create/Create";
import QuickAnalyze from "./QuickAnalyze";
import { LoadingPlaceholder, NoneFound, Pagination, ViewHeader } from "../../base";
import { createFindURL } from "../../utils";

const SamplesList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let sampleComponents = map(props.documents, document =>
        <SampleEntry
            key={document.id}
            id={document.id}
            userId={document.user.id}
            {...document}
        />
    );

    if (!props.documents.length) {
        sampleComponents = <NoneFound key="noSample" noun="samples" noListGroup />;
    }

    return (
        <div>
            <ViewHeader
                title="Samples"
                page={props.page}
                count={props.documents.length}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            <SampleToolbar />

            <ListGroup>
                {sampleComponents}
            </ListGroup>

            <Pagination
                documentCount={props.documents.length}
                onPage={props.onFind}
                page={props.page}
                pageCount={props.page_count}
            />

            <CreateSample />

            <QuickAnalyze />
        </div>
    );
};

const mapStateToProps = (state) => ({...state.samples});

const mapDispatchToProps = (dispatch) => ({
    onFind: (page) => {
        const url = createFindURL({page});
        dispatch(push(url.pathname + url.search));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
