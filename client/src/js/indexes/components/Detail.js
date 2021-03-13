import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    LoadingPlaceholder,
    NarrowContainer,
    NotFound,
    RelativeTime,
    SubviewHeader,
    SubviewHeaderAttribution,
    SubviewHeaderTitle
} from "../../base";
import { DownloadLink } from "../../references/components/Detail/DownloadLink";
import { getIndex, getIndexHistory } from "../actions";
import IndexGeneral from "./General";

const IndexDetailSubtitle = styled.div`
    align-items: center;
    display: flex;

    a {
        margin-left: auto;
    }
`;

export class IndexDetail extends React.Component {
    componentDidMount() {
        this.props.onGetIndex(this.props.match.params.indexId);
        this.props.onGetChanges(this.props.match.params.indexId, 1);
    }

    render() {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null || this.props.refDetail === null) {
            return <LoadingPlaceholder />;
        }

        const { version, created_at, user, id, has_json } = this.props.detail;

        return (
            <React.Fragment>
                <SubviewHeader>
                    <SubviewHeaderTitle>Index {version}</SubviewHeaderTitle>
                    <IndexDetailSubtitle>
                        <SubviewHeaderAttribution>
                            {user.id} built <RelativeTime time={created_at} />
                        </SubviewHeaderAttribution>
                        {has_json && <DownloadLink id={id} />}
                    </IndexDetailSubtitle>
                </SubviewHeader>

                <NarrowContainer>
                    <IndexGeneral />
                </NarrowContainer>
            </React.Fragment>
        );
    }
}

export const mapStateToProps = state => ({
    error: get(state, "errors.GET_INDEX_ERROR", null),
    detail: state.indexes.detail,
    refDetail: state.references.detail
});

export const mapDispatchToProps = dispatch => ({
    onGetIndex: indexId => {
        dispatch(getIndex(indexId));
    },

    onGetChanges: (indexId, page) => {
        dispatch(getIndexHistory(indexId, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(IndexDetail);
