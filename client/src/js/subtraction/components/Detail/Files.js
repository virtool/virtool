import React from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { BoxGroupHeader, BoxGroup, NoneFound } from "../../../base";
import { SubtractionFile } from "./File";

export const SubtractionFiles = ({ files }) => {
    if (files.length == 0) {
        return <NoneFound noun="subtraction files" />;
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>Files</h2>
                <p>Data files available to workflows using this subtraction.</p>
            </BoxGroupHeader>
            {files.map(file => (
                <SubtractionFile file={file} key={file.id} />
            ))}
        </BoxGroup>
    );
};

const mapStateToProps = state => {
    return {
        files: get(state, "subtraction.detail.files", [])
    };
};

export default connect(mapStateToProps)(SubtractionFiles);
