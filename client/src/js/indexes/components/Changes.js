/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Row, Col, ListGroup, ListGroupItem, Pagination } from "react-bootstrap";

import { getIndexHistory } from "../actions";

class IndexChanges extends React.Component {

    constructor (props) {
        super(props);
    }

    static propTypes = {
        match: PropTypes.object,
        detail: PropTypes.object,
        history: PropTypes.object,
        page: PropTypes.number,
        pageCount: PropTypes.number,
        onGet: PropTypes.func
    };

    componentWillMount () {
        this.props.onGet(this.props.match.params.indexVersion);
    }

    render () {

        if (this.props.history === null || this.props.detail === null) {
            return <div />;
        }

        const history = this.props.history;

        const changeComponents = history.documents.map(change => {
            return (
                <ListGroupItem key={change.id} className="spaced">
                    <Row>
                        <Col xs={12} md={6}>
                            <strong>{change.virus.name}</strong>
                        </Col>
                        <Col xs={12} md={6}>
                            {change.description}
                        </Col>
                    </Row>
                </ListGroupItem>
            );
        });

        return (
            <div>
                <ListGroup>
                    {changeComponents}
                </ListGroup>

                <div className="text-center">
                    <Pagination
                        items={history.pageCount}
                        maxButtons={10}
                        activePage={history.page}
                        onSelect={this.handlePage}
                        first
                        last
                        next
                        prev
                    />
                </div>
            </div>
        );
    }
}

IndexChanges.propTypes = {
    detail: PropTypes.object
};

const mapStateToProps = (state) => {
    return {
        detail: state.indexes.detail,
        history: state.indexes.history,

    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (indexVersion) => {
            dispatch(getIndexHistory(indexVersion));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IndexChanges);

export default Container;
