import React from "react";
import { connect } from "react-redux";
import { forEach, slice, includes, pull } from "lodash-es";
import CreateAnalysis from "../../analyses/components/Create";
import { LoadingPlaceholder, NoneFound, ScrollList, ViewHeader } from "../../base";
import { findSamples } from "../actions";
import { analyze } from "../../analyses/actions";
import { listReadyIndexes } from "../../indexes/actions";
import { findHmms } from "../../hmm/actions";
import { getTerm } from "../selectors";
import CreateSample from "./Create/Create";
import SampleToolbar from "./Toolbar";
import SampleItem from "./Item";

export class SamplesList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            lastChecked: null,
            sampleId: ""
        };
    }

    componentDidMount() {
        this.props.onFindHmms();
        this.props.onListReadyIndexes();
        this.props.onLoadNextPage(this.props.term, 1);
    }

    onSelect = (id, index, isShiftKey) => {
        const newSelected = [...this.props.selected];

        let selectedSegment;

        if (isShiftKey && this.state.lastChecked !== index) {
            let startIndex;
            let endIndex;

            if (this.state.lastChecked < index) {
                startIndex = this.state.lastChecked;
                endIndex = index;
            } else {
                startIndex = index;
                endIndex = this.state.lastChecked;
            }

            selectedSegment = slice(this.props.documents, startIndex, endIndex + 1);
        } else {
            selectedSegment = [this.props.documents[index]];
        }

        if (includes(this.props.selected, this.props.documents[index].id)) {
            forEach(selectedSegment, entry => {
                pull(newSelected, entry.id);
            });
        } else {
            forEach(selectedSegment, entry => {
                if (!includes(newSelected, entry.id)) {
                    newSelected.push(entry.id);
                }
            });
        }

        this.setState({
            lastChecked: index
        });
    };

    renderRow = index => {
        return <SampleItem key={this.props.documents[index].id} id={this.props.documents[index].id} />;
    };

    render() {
        if (this.props.documents === null || this.props.hmms.documents === null || this.props.indexes === null) {
            return <LoadingPlaceholder />;
        }

        let noSamples;

        if (!this.props.documents.length) {
            noSamples = <NoneFound key="noSample" noun="samples" noListGroup />;
        }

        return (
            <div>
                <ViewHeader title="Samples" totalCount={this.props.total_count} />

                <SampleToolbar />

                {noSamples || (
                    <ScrollList
                        documents={this.props.documents}
                        page={this.props.page}
                        pageCount={this.props.page_count}
                        onLoadNextPage={page => this.props.onLoadNextPage(this.props.term, page)}
                        renderRow={this.renderRow}
                    />
                )}

                <CreateSample />
                <CreateAnalysis />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    userId: state.account.id,
    ...state.samples,
    term: getTerm(state),
    hmms: state.hmms
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page) => {
        dispatch(findSamples(term, page));
    },

    onFindHmms: () => {
        dispatch(findHmms(null, 1, false));
    },

    onListReadyIndexes: () => {
        dispatch(listReadyIndexes());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SamplesList);
