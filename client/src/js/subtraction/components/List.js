import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { FormControl, FormGroup, InputGroup } from "react-bootstrap";

import CreateSubtraction from "./Create";
import SubtractionItem from "./Item";
import { Alert, Button, Icon, NoneFound, ViewHeader, ScrollList } from "../../base";
import { checkAdminOrPermission } from "../../utils";
import { filterSubtractions, listSubtractions } from "../actions";

const SubtractionToolbar = ({ term, onFilter, canModify }) => (
    <div key="toolbar" className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="search" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={term}
                    onChange={onFilter}
                    placeholder="Name"
                />
            </InputGroup>
        </FormGroup>

        {canModify ? (
            <LinkContainer to={{state: {createSubtraction: true}}}>
                <Button bsStyle="primary" icon="plus-square" tip="Create" />
            </LinkContainer>
        ) : null}
    </div>
);

class SubtractionList extends React.Component {

    componentDidMount () {
        if (!this.props.fetched) {
            this.props.loadNextPage(1);
        }
    }

    rowRenderer = (index) => (
        <SubtractionItem
            key={this.props.documents[index].id}
            {...this.props.documents[index]}
        />
    );

    render () {

        let subtractionComponents;
        let alert;

        if (this.props.documents && !this.props.documents.length) {
            subtractionComponents = (
                <div className="list-group">
                    <NoneFound noun="subtractions" noListGroup />
                </div>
            );
        } else {
            subtractionComponents = (
                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.props.documents}
                    refetchPage={this.props.refetchPage}
                    loadNextPage={this.props.loadNextPage}
                    page={this.props.page}
                    rowRenderer={this.rowRenderer}
                />
            );
        }

        if (!this.props.ready_host_count && !this.props.total_count) {
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
                <ViewHeader title="Subtraction" totalCount={this.props.total_count} />

                {alert}

                <SubtractionToolbar
                    term={this.props.filter}
                    onFilter={this.props.onFilter}
                    canModify={this.props.canModify}
                />

                {subtractionComponents}

                <CreateSubtraction />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.subtraction,
    canModify: checkAdminOrPermission(state.account.administrator, state.account.permissions, "modify_subtraction")
});

const mapDispatchToProps = (dispatch) => ({

    onFilter: (e) => {
        dispatch(filterSubtractions(e.target.value));
    },

    loadNextPage: (page) => {
        if (page) {
            dispatch(listSubtractions(page));
        }
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionList);
