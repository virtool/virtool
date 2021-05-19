import { forEach, includes, pull, slice } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getAccountId } from "../../account/selectors";
import QuickAnalysis from "../../analyses/components/Create/Quick";
import {
    Badge,
    LoadingPlaceholder,
    NarrowContainer,
    NoneFoundBox,
    ScrollList,
    SideContainer,
    ViewHeader,
    ViewHeaderTitle
} from "../../base";
import { findHmms } from "../../hmm/actions";
import { listReadyIndexes } from "../../indexes/actions";
import { listLabels } from "../../labels/actions";
import { findSamples } from "../actions";
import { SampleFilters } from "./Filter/Filters";
import SampleItem from "./Item/Item";
import SampleToolbar from "./Toolbar";

const StyledSamplesList = styled.div`
    align-items: stretch;
    display: flex;

    th {
        width: 220px;
    }
`;

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
        this.props.onListLabels();
        this.props.onListReadyIndexes();
        this.props.onLoadNextPage(1);
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
        if (this.props.loading) {
            return <LoadingPlaceholder />;
        }

        let noneFound;

        if (!this.props.documents.length) {
            noneFound = <NoneFoundBox key="noSample" noun="samples" />;
        }

        return (
            <React.Fragment>
                <NarrowContainer>
                    <ViewHeader title="Samples">
                        <ViewHeaderTitle>
                            Samples <Badge>{this.props.total_count}</Badge>
                        </ViewHeaderTitle>
                    </ViewHeader>
                    <SampleToolbar />
                </NarrowContainer>
                <StyledSamplesList>
                    <NarrowContainer>
                        {noneFound || (
                            <ScrollList
                                documents={this.props.documents}
                                page={this.props.page}
                                pageCount={this.props.page_count}
                                onLoadNextPage={page => this.props.onLoadNextPage(page)}
                                renderRow={this.renderRow}
                            />
                        )}
                        <QuickAnalysis />
                    </NarrowContainer>
                    <SideContainer>
                        <SampleFilters />
                    </SideContainer>
                </StyledSamplesList>
            </React.Fragment>
        );
    }
}

const mapStateToProps = state => {
    const loading =
        state.hmms.documents === null ||
        state.samples.documents === null ||
        state.samples.readyIndexes === null ||
        state.labels.documents === null;

    return {
        loading,
        userId: getAccountId(state),
        ...state.samples
    };
};

const mapDispatchToProps = dispatch => ({
    onLoadNextPage: page => {
        dispatch(findSamples({ page }));
    },

    onFindHmms: () => {
        dispatch(findHmms("", 1));
    },

    onListLabels: () => {
        dispatch(listLabels());
    },

    onListReadyIndexes: () => {
        dispatch(listReadyIndexes());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
