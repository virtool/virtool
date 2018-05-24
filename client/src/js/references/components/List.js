import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";

import AddReference from "./AddReference";
import { ViewHeader, Flex, NoneFound } from "../../base";
import ReferenceItem from "./ReferenceItem";
import ReferenceToolbar from "./Toolbar";

const ReferenceContainer = ({ references }) => (
    <Flex
        direction="row"
        wrap="wrap"
        alignItems="stretch"
        style={{minHeight: "min-content", marginRight: "-15px"}}
    >
        {references}
    </Flex>
);

const ReferenceList = (props) => {

    if (props.documents === null) {
        return <div />;
    }

    let referenceComponents;

    if (props.documents.length) {
        referenceComponents = map(props.documents, document =>
            <ReferenceItem key={document.id} {...document} />
        );
    } else {
        referenceComponents = <NoneFound noun="references" noListGroup />;
    }

    return (
        <div>
            <ViewHeader
                title="References"
                page={props.page}
                count={props.documents.length}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            <ReferenceToolbar />

            <ReferenceContainer references={referenceComponents} />

            {props.routerStateExists ? <AddReference /> : null}
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.references,
    account: state.account,
    routerStateExists: !!state.router.location.state
});

export default connect(mapStateToProps, null)(ReferenceList);
