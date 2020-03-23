import React from "react";
import { connect } from "react-redux";
import {
    Alert,
    Badge,
    Icon,
    LoadingPlaceholder,
    NoneFoundBox,
    ScrollList,
    ViewHeader,
    ViewHeaderTitle
} from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { findSubtractions } from "../actions";
import CreateSubtraction from "./Create";
import SubtractionItem from "./Item";
import SubtractionToolbar from "./Toolbar";

export class SubtractionList extends React.Component {
    componentDidMount() {
        if (!this.props.fetched) {
            this.props.onLoadNextPage(this.props.term, 1);
        }
    }

    renderRow = index => <SubtractionItem key={index} index={index} />;

    render() {
        let subtractionComponents;

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        if (this.props.documents.length) {
            subtractionComponents = (
                <ScrollList
                    documents={this.props.documents}
                    onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                    page={this.props.page}
                    pageCount={this.props.page_count}
                    renderRow={this.renderRow}
                />
            );
        } else {
            subtractionComponents = <NoneFoundBox noun="subtractions" />;
        }

        let alert;

        if (!this.props.ready_host_count && !this.props.total_count) {
            alert = (
                <Alert color="orange" level>
                    <Icon name="exclamation-circle" />
                    <strong>A host genome must be added before samples can be created and analyzed.</strong>
                </Alert>
            );
        }

        return (
            <div>
                <ViewHeader title="Subtraction">
                    <ViewHeaderTitle>
                        Subtraction <Badge>{this.props.total_count}</Badge>
                    </ViewHeaderTitle>
                </ViewHeader>

                {alert}

                <SubtractionToolbar />

                {subtractionComponents}

                <CreateSubtraction />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.subtraction,
    canModify: checkAdminOrPermission(state, "modify_subtraction")
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page) => {
        dispatch(findSubtractions(term, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionList);
