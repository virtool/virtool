import React, { useEffect } from "react";
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

export const SamplesList = ({ documents, loading, match, page, pageCount, totalCount, onFindSamples, onFindOther }) => {
    useEffect(onFindOther, [null]);

    useEffect(() => {
        onFindSamples(1);
    }, [match]);

    const renderRow = index => {
        return <SampleItem key={documents[index].id} id={documents[index].id} />;
    };

    if (loading) {
        return <LoadingPlaceholder />;
    }

    let noneFound;

    if (!documents.length) {
        noneFound = <NoneFoundBox key="noSample" noun="samples" />;
    }

    return (
        <React.Fragment>
            <NarrowContainer>
                <ViewHeader title="Samples">
                    <ViewHeaderTitle>
                        Samples <Badge>{totalCount}</Badge>
                    </ViewHeaderTitle>
                </ViewHeader>
                <SampleToolbar />
            </NarrowContainer>
            <StyledSamplesList>
                <NarrowContainer>
                    {noneFound || (
                        <ScrollList
                            documents={documents}
                            page={page}
                            pageCount={pageCount}
                            onLoadNextPage={page => onFindSamples(page)}
                            renderRow={renderRow}
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
};

export const mapStateToProps = state => {
    const loading =
        state.hmms.documents === null ||
        state.samples.documents === null ||
        state.samples.readyIndexes === null ||
        state.labels.documents === null;

    const { documents, page, page_count, selected, total_count } = state.samples;

    return {
        documents,
        loading,
        userId: getAccountId(state),
        page,
        pageCount: page_count,
        selected,
        totalCount: total_count
    };
};

export const mapDispatchToProps = dispatch => ({
    onFindSamples: page => {
        dispatch(findSamples({ page }));
    },

    onFindOther: () => {
        dispatch(findHmms("", 1));
        dispatch(listLabels());
        dispatch(listReadyIndexes());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
