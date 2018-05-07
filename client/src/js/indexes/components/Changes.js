import React from "react";
import { map } from "lodash-es";
import { Row, Col, ListGroup, ListGroupItem } from "react-bootstrap";
import { connect } from "react-redux";


import { getIndexHistory } from "../actions";
import { LoadingPlaceholder, Pagination } from "../../base";

class IndexChanges extends React.Component {

    componentWillMount () {
        this.props.onGet(this.props.match.params.indexVersion, 1);
    }

    handlePage = (page) => {
        this.props.onGet(this.props.match.params.indexVersion, page);
    }

    render () {

        if (this.props.history === null || this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const history = this.props.history;

        const changeComponents = map(history.documents, change =>
            <ListGroupItem key={change.id} className="spaced">
                <Row>
                    <Col xs={12} md={6}>
                        <strong>{change.OTU.name}</strong>
                    </Col>
                    <Col xs={12} md={6}>
                        {change.description}
                    </Col>
                </Row>
            </ListGroupItem>
        );

        return (
            <div>
                <ListGroup>
                    {changeComponents}
                </ListGroup>

                <div className="text-center">
                    <Pagination
                        documentCount={history.documents.length}
                        onPage={this.handlePage}
                        page={history.page}
                        pageCount={history.page_count}
                    />
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    detail: state.indexes.detail,
    history: state.indexes.history
});

const mapDispatchToProps = (dispatch) => ({

    onGet: (indexVersion, page) => {
        dispatch(getIndexHistory(indexVersion, page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(IndexChanges);
