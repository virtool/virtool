import React from "react";
import { map } from "lodash-es";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";

import CreateSubtraction from "./Create";
import SubtractionItem from "./Item";
import { Alert, Button, Icon, LoadingPlaceholder, NoneFound, ViewHeader } from "../../base";
import { createFindURL, getFindTerm, checkAdminOrPermission } from "../../utils";

const SubtractionList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let subtractionComponents = map(props.documents, document =>
        <SubtractionItem
            key={document.id}
            {...document}
        />
    );

    if (!subtractionComponents.length) {
        subtractionComponents = <NoneFound noun="subtractions" noListGroup />;
    }

    let alert;

    if (!props.ready_host_count) {
        alert = (
            <Alert bsStyle="warning" icon="info-circle">
                <strong>
                    A host genome must be added before samples can be created and analyzed.
                </strong>
            </Alert>
        );
    }

    return (
        <div>
            <ViewHeader title="Subtraction" totalCount={props.total_count} />

            {alert}

            <div key="toolbar" className="toolbar">
                <FormGroup>
                    <InputGroup>
                        <InputGroup.Addon>
                            <Icon name="search" />
                        </InputGroup.Addon>
                        <FormControl
                            type="text"
                            value={props.term}
                            onChange={props.onFind}
                            placeholder="Name"
                        />
                    </InputGroup>
                </FormGroup>

                {props.canModify ? (
                    <LinkContainer to={{state: {createSubtraction: true}}}>
                        <Button bsStyle="primary" icon="plus-square" tip="Create" />
                    </LinkContainer>
                ) : null}
            </div>

            <div className="list-group">
                {subtractionComponents}
            </div>

            <CreateSubtraction />
        </div>
    );
};

const mapStateToProps = (state) => ({
    ...state.subtraction,
    term: getFindTerm(),
    canModify: checkAdminOrPermission(state.account.administrator, state.account.permissions, "modify_subtraction")
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (e) => {
        const url = createFindURL({find: e.target.value});
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionList);
