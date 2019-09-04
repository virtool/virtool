import { map, snakeCase } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader, Icon } from "../../../base";
import { replaceLegacyFiles } from "../../actions";
import { getIsReadyToReplace } from "../../selectors";
import SampleRawItem from "./RawItem";

const SampleFilesRawTitle = styled.h2`
    display: flex;
    justify-content: space-between;

    & > a {
        cursor: pointer;
    }
`;

export const SampleFilesRaw = ({ id, files, isReadyToReplace, prefix, onReplace }) => {
    const fileComponents = map(files, (file, index) => (
        <SampleRawItem key={file.name} {...file} prefix={prefix} suffix={index + 1} />
    ));

    let replaceLink;

    if (isReadyToReplace) {
        replaceLink = (
            <a onClick={() => onReplace(id)}>
                <Icon name="exchange" /> Redo
            </a>
        );
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <SampleFilesRawTitle>
                    Raw Data
                    {replaceLink}
                </SampleFilesRawTitle>
                <p>The input sequencing data used to create this sample.</p>
            </BoxGroupHeader>
            {fileComponents}
        </BoxGroup>
    );
};

const mapStateToProps = state => {
    const { id, files, name } = state.samples.detail;
    return {
        files,
        id,
        prefix: snakeCase(name),
        isReadyToReplace: getIsReadyToReplace(state)
    };
};

const mapDispatchToProps = dispatch => ({
    onReplace: id => {
        dispatch(replaceLegacyFiles(id));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleFilesRaw);
