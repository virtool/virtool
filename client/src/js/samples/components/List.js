import { forEach, includes, pull, slice } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { getAccountId } from "../../account/selectors";
import QuickAnalysis from "../../analyses/components/Create/Quick";
import {
    Badge,
    LoadingPlaceholder,
    NarrowContainer,
    NoneFoundBox,
    ScrollList,
    ViewHeader,
    ViewHeaderTitle
} from "../../base";
import { findHmms } from "../../hmm/actions";
import { listReadyIndexes } from "../../indexes/actions";
import { findSamples } from "../actions";
import { getTerm } from "../selectors";
import SampleItem from "./Item/Item";
import SampleToolbar from "./Toolbar";

export class SamplesList extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            lastChecked: null,
            sampleId: ""
        };
    }

    componentDidMount() {
        const { nuvs, pathoscope, term } = this.props;
        this.props.onFindHmms();
        this.props.onListReadyIndexes();
        this.props.onLoadNextPage(term, 1, pathoscope, nuvs);
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

        let noneFound;

        if (!this.props.documents.length) {
            noneFound = <NoneFoundBox key="noSample" noun="samples" />;
        }

        const { term, pathoscope, nuvs } = this.props;

        return (
            <NarrowContainer>
                <ViewHeader title="Samples">
                    <ViewHeaderTitle>
                        Samples <Badge>{this.props.total_count}</Badge>
                    </ViewHeaderTitle>
                </ViewHeader>

                <SampleToolbar />

                {noneFound || (
                    <ScrollList
                        documents={this.props.documents}
                        page={this.props.page}
                        pageCount={this.props.page_count}
                        onLoadNextPage={page => this.props.onLoadNextPage(term, page, pathoscope, nuvs)}
                        renderRow={this.renderRow}
                    />
                )}
                <QuickAnalysis />
            </NarrowContainer>
        );
    }
}

const mapStateToProps = state => ({
    userId: getAccountId(state),
    ...state.samples,
    term: getTerm(state),
    pathoscope: state.samples.pathoscopeCondition,
    nuvs: state.samples.nuvsCondition,
    hmms: state.hmms
});

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: (term, page, pathoscope, nuvs) => {
        dispatch(findSamples(term, page, pathoscope, nuvs));
    },

    onFindHmms: () => {
        dispatch(findHmms("", 1, false));
    },

    onListReadyIndexes: () => {
        dispatch(listReadyIndexes());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
