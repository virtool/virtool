import React from "react";
import FlipMove from "react-flip-move";
import { sortBy } from "lodash-es";
import { Icon, ListGroupItem } from "virtool/js/components/Base";
import ReadFile from "./ReadFile";

const NoReadFiles = () => (
    <ListGroupItem>
        <Icon name="info" /> No uploads in progress
    </ListGroupItem>
);

const ReadFileList = (props) => {

    let fileComponents;

    if (this.props.files.length > 0) {
        fileComponents = sortBy(props.files, "timestamp").reverse().map(file =>
            <ReadFile key={file._id} {...file} />
        );
    } else {
        fileComponents = <NoReadFiles />
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
