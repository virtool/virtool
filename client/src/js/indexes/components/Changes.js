import React from "react";
import { Row, Col, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";

import { getIndexHistory } from "../actions";
import { LoadingPlaceholder, ScrollList } from "../../base";

class IndexChanges extends React.Component {
    componentDidMount() {
        if (!this.props.history) {
            this.props.handlePage(1);
        }
    }

    handlePage = page => {
        this.props.onLoadNextPage(this.props.detail.id, page);
    };

    rowRenderer = index => (
        <ListGroupItem key={this.props.history.documents[index].id} className="spaced">
            <Row>
                <Col xs={12} md={6}>
                    <strong>{this.props.history.documents[index].otu.name}</strong>
                </Col>
                <Col xs={12} md={6}>
                    {this.props.history.documents[index].description}
                </Col>
            </Row>
        </ListGroupItem>
    );

    render() {
        if (this.props.history === null || this.props.history.documents === null || this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        return (
            <div>
                <ScrollList
                    documents={this.props.history.documents}
                    onLoadNextPage={this.handlePage}
                    page={this.props.history.page}
                    pageCount={this.props.history.page_coount}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    detail: state.indexes.detail,
    history: state.indexes.history
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (indexId, page) => {
        dispatch(getIndexHistory(indexId, page));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(IndexChanges);
