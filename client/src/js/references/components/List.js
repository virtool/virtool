import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Panel, Button } from "react-bootstrap";
import AddReference from "./AddReference";
import { ViewHeader, Flex } from "../../base";
import ReferenceItem from "./ReferenceItem";
import ReferenceToolbar from "./Toolbar";
import { remoteReference } from "../actions";

const ReferenceContainer = ({ remoteCard, references }) => (
    <Flex
        direction="row"
        wrap="wrap"
        alignItems="stretch"
        style={{minHeight: "min-content", marginRight: "-15px"}}
    >
        {references}
        {remoteCard}
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
    }

    const remoteReferenceCard = (
        <Panel className="reference-item-remote">
            <span className="reference-remote-contents">
                <p>Official Remote Reference</p>
                <Button bsStyle="primary" onClick={props.onRemote}>
                    Install
                </Button>
            </span>
        </Panel>
    );

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

            <ReferenceContainer remoteCard={remoteReferenceCard} references={referenceComponents} />

            {props.routerStateExists ? <AddReference /> : null}
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.references,
    account: state.account,
    routerStateExists: !!state.router.location.state
});

const mapDispatchToProps = dipatch => ({
    onRemote: () => {
        dipatch(remoteReference());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceList);
