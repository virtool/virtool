import { map, snakeCase } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { BoxGroup, BoxGroupHeader } from "../../../base";
import { SampleRawItem } from "./RawItem";

const SampleFilesRawTitle = styled.h2`
    display: flex;
    justify-content: space-between;

    & > a {
        cursor: pointer;
    }
`;

export const SampleFilesRaw = ({ files, prefix }) => {
    const fileComponents = map(files, (file, index) => (
        <SampleRawItem key={file.name} {...file} prefix={prefix} suffix={index + 1} />
    ));

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <SampleFilesRawTitle>Raw Data</SampleFilesRawTitle>
                <p>The input sequencing data used to create this sample.</p>
            </BoxGroupHeader>
            {fileComponents}
        </BoxGroup>
    );
};

export const mapStateToProps = state => {
    const { id, files, name } = state.samples.detail;
    return {
        files,
        id,
        prefix: snakeCase(name)
    };
};

export default connect(mapStateToProps)(SampleFilesRaw);
