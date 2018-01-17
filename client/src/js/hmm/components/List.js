import React from "react";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { FormControl, FormGroup, InputGroup, ListGroup } from "react-bootstrap";

import HMMItem from "./Item";
import HMMInstaller from "./Installer";
import { Icon, LoadingPlaceholder, NoneFound, Pagination, ViewHeader } from "../../base";
import { createFindURL, getFindTerm } from "../../utils";

const HMMList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let rowComponents;

    if (props.documents.length) {
        rowComponents = props.documents.map(document =>
            <HMMItem key={document.id} {...document} />
        );
    } else {
        rowComponents = <NoneFound noun="profiles" noListGroup />;
    }

    return (
        <div>
            <ViewHeader
                title="HMMs"
                page={props.page}
                count={props.documents.length}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            {props.file_exists ? null : <HMMInstaller />}

            <FormGroup>
                <InputGroup>
                    <InputGroup.Addon>
                        <Icon name="search" />
                    </InputGroup.Addon>

                    <FormControl
                        type="text"
                        placeholder="Definition, cluster, family"
                        onChange={(e) => props.onFind({find: e.target.value})}
                        value={props.term}
                    />
                </InputGroup>
            </FormGroup>

            <ListGroup>
                {rowComponents}
            </ListGroup>

            <Pagination
                documentCount={props.documents.length}
                page={props.page}
                pageCount={props.page_count}
                onPage={(page) => props.onFind({page})}
            />
        </div>
    );
};

const mapStateToProps = (state) => ({
    ...state.hmms,
    term: getFindTerm()
});

const mapDispatchToProps = (dispatch) => ({

    onFind: ({find, page}) => {
        const url = createFindURL({find, page});
        dispatch(push(url.pathname + url.search));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(HMMList);

export default Container;
