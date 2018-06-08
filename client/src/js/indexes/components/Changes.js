import React from "react";
import { Row, Col, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";

import { getIndexHistory } from "../actions";
import { LoadingPlaceholder, ScrollList } from "../../base";
import { getUpdatedScrollListState } from "../../utils";

class IndexChanges extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.history ? this.props.history.documents : [],
            list: this.props.history ? this.props.history.documents : [],
            page: this.props.history ? this.props.history.page : 1
        };
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        if (nextProps.history === null) {
            return null;
        }

        return getUpdatedScrollListState(nextProps, prevState);
    }

    handlePage = (page) => {
        this.props.onGet(this.props.detail.id, page);
    };

    rowRenderer = (index) => (
        <ListGroupItem key={this.state.masterList[index].id} className="spaced">
            <Row>
                <Col xs={12} md={6}>
                    <strong>{this.state.masterList[index].otu.name}</strong>
                </Col>
                <Col xs={12} md={6}>
                    {this.state.masterList[index].description}
                </Col>
            </Row>
        </ListGroupItem>
    );

    render () {

        if (this.props.history === null || this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        return (
            <div>
                <ScrollList
                    hasNextPage={this.props.history.page < this.props.history.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.state.masterList}
                    loadNextPage={this.handlePage}
                    page={this.state.page}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    detail: state.indexes.detail,
    history: state.indexes.history,
    isLoading: state.indexes.isLoading,
    errorLoad: state.indexes.errorLoad
});

const mapDispatchToProps = (dispatch) => ({

    onGet: (indexId, page) => {
        dispatch(getIndexHistory(indexId, page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IndexChanges);
