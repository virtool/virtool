import { map } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import {
    Panel,
    LoadingPlaceholder,
    RelativeTime,
    SubviewHeader,
    SubviewHeaderAttribution,
    SubviewHeaderTitle,
    Table
} from "../../base";
import { getCache } from "../actions";
import CacheQuality from "./Quality";

const CacheGeneral = ({ hash, program }) => (
    <Table>
        <tbody>
            <tr>
                <th>Hash</th>
                <td>{hash}</td>
            </tr>
            <tr>
                <th>Trimming Program</th>
                <td>{program}</td>
            </tr>
        </tbody>
    </Table>
);

const CacheParameterKey = styled.th`
    font-family: "Roboto Mono", monospace;
    padding-left: 15px !important;
`;

const CacheParameters = ({ parameters }) => {
    const rowComponents = map(parameters, (value, key) => (
        <tr key={key}>
            <CacheParameterKey>{key}</CacheParameterKey>
            <td>{value}</td>
        </tr>
    ));
    return (
        <Panel>
            <Panel.Heading>Trim Parameters</Panel.Heading>
            <Table>
                <tbody>{rowComponents}</tbody>
            </Table>
        </Panel>
    );
};

const StyledCacheDetail = styled.div`
    overflow-x: hidden;
`;

const CacheDetail = ({ detail, match, sampleName, onGet }) => {
    useEffect(() => onGet(match.params.cacheId), [match.params.cacheId]);

    if (detail === null) {
        return <LoadingPlaceholder />;
    }

    return (
        <StyledCacheDetail>
            <SubviewHeader>
                <SubviewHeaderTitle>Cache for {sampleName}</SubviewHeaderTitle>
                <SubviewHeaderAttribution>
                    Created <RelativeTime time={detail.created_at} />
                </SubviewHeaderAttribution>
            </SubviewHeader>
            <CacheGeneral {...detail} />
            <CacheParameters parameters={detail.parameters} />
            <CacheQuality />
        </StyledCacheDetail>
    );
};

const mapStateToProps = state => {
    return {
        detail: state.caches.detail,
        sampleName: state.samples.detail.name
    };
};

const mapDispatchToProps = dispatch => ({
    onGet: cacheId => {
        dispatch(getCache(cacheId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(CacheDetail);
