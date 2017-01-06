import React from "react";
import FlipMove from "react-flip-move";
import { sortBy } from "lodash";
import { Icon, ListGroupItem } from "virtool/js/components/Base";
import ReadFile from "./ReadFile";

const ReadFileList = (props) => {

    let fileComponents;

    if (props.files.length > 0) {
        fileComponents = sortBy(props.files, "timestamp").reverse().map(file =>
            <div key={file._id}><ReadFile {...file} /></div>
        );
    } else {
        fileComponents = (
            <ListGroupItem className="text-center" key="noFiles">
                <Icon name="info" /> No files found
            </ListGroupItem>
        );
    }

    return (
        <div style={{marginTop: "15px"}}>
            <h5>
                {props.header}
            </h5>

            <FlipMove typeName="div" className="list-group">
                {fileComponents}
            </FlipMove>
        </div>
    );
};

ReadFileList.propTypes = {
    header: React.PropTypes.element,
    files: React.PropTypes.arrayOf(React.PropTypes.object)
};

export default ReadFileList;
