import React from "react";
import { connect } from "react-redux";
import { BoxGroup, BoxGroupHeader, NoneFound } from "../../../base";
import { SubtractionFile } from "./File";

export const SubtractionFiles = ({ files }) => {
    let fileComponents = files.map(file => <SubtractionFile file={file} key={file.id} />);

    if (files.length === 0) {
        fileComponents = <NoneFound noun="subtraction files" />;
    }

    return (
        <BoxGroup>
            <BoxGroupHeader>
                <h2>Files</h2>
                <p>Data files available to workflows using this subtraction.</p>
            </BoxGroupHeader>
            {fileComponents}
        </BoxGroup>
    );
};

export const mapStateToProps = state => ({ files: state.subtraction.detail.files });

export default connect(mapStateToProps)(SubtractionFiles);
