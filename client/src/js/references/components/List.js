import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { Panel, Button } from "react-bootstrap";
import AddReference from "./AddReference";
import ReferenceItem from "./ReferenceItem";
import ReferenceToolbar from "./Toolbar";
import { remoteReference } from "../actions";
import { ViewHeader, LoadingPlaceholder, NoneFound } from "../../base";
import { checkAdminOrPermission } from "../../utils";

const ReferenceList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let referenceComponents = [];
    let noRefs;

    if (props.documents.length) {
        referenceComponents = map(props.documents, document =>
            <ReferenceItem key={document.id} {...document} />
        );
    } else {
        noRefs = <NoneFound noun="References" />;
    }

    const officialRemote = (!props.installOfficial && props.canCreateRef) ? (
        <Panel key="remote" className="card reference-remote">
            <span>
                <p>Official Remote Reference</p>
                <Button bsStyle="primary" onClick={props.onRemote}>
                    Install
                </Button>
            </span>
        </Panel>
    ) : null;

    return (
        <div>
            <ViewHeader title="References" totalCount={props.total_count} />

            <ReferenceToolbar canCreate={props.canCreateRef} />

            <div className="card-container">
                {referenceComponents}
                {officialRemote}
            </div>

            {officialRemote ? null : noRefs}

            {props.routerStateExists ? <AddReference /> : null}
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.references,
    account: state.account,
    routerStateExists: !!state.router.location.state,
    canCreateRef: checkAdminOrPermission(state.account.administrator, state.account.permissions, "create_ref")
});

const mapDispatchToProps = dipatch => ({
    onRemote: () => {
        dipatch(remoteReference());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceList);
