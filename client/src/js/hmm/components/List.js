import React from "react";
import { connect } from "react-redux";
import { LoadingPlaceholder, ViewHeader, ScrollList, NoneFound } from "../../base";
import { findHmms } from "../actions";
import { getTerm } from "../selectors";
import HMMItem from "./Item";
import HMMInstaller from "./Installer";
import HMMToolbar from "./Toolbar";

class HMMList extends React.Component {
    componentDidMount() {
        this.props.onLoadNextPage(this.props.term, 1);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.status && !prevProps.status.installed && this.props.status.installed) {
            this.props.onLoadNextPage(this.props.term, 1);
        }
    }

    renderRow = index => {
        const document = this.props.documents[index];
        return <HMMItem key={document.id} {...document} />;
    };

    render() {
        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        if (this.props.status.installed) {
            let list;

            if (this.props.documents.length) {
                list = (
                    <ScrollList
                        documents={this.props.documents}
                        onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                        page={this.props.page}
                        pageCount={this.props.page_count}
                        renderRow={this.renderRow}
                    />
                );
            } else {
                list = <NoneFound noun="HMMs" />;
            }

            return (
                <div>
                    <ViewHeader title="HMMs" totalCount={this.props.found_count} />
                    <HMMToolbar />
                    {list}
                </div>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>HMMs</strong>
                </h3>
                <HMMInstaller />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.hmms,
    term: getTerm(state)
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page) => {
        dispatch(findHmms(term, page, false));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(HMMList);
