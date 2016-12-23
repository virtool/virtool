import React from "react";
import FlipMove from "react-flip-move";
import {sortBy} from "lodash";
import {ListGroupItem} from "react-bootstrap";
import Icon from "virtool/js/components/Base/Icon";
import ReadFile from "./ReadFile";

export default class ReadFileList extends React.Component {

    static propTypes = {
        header: React.PropTypes.element,
        files: React.PropTypes.arrayOf(React.PropTypes.object)
    }

    render () {

        let fileComponents;

        if (this.props.files.length > 0) {
            fileComponents = sortBy(this.props.files, "timestamp").reverse().map(file => {
                return <ReadFile key={file._id} {...file} />
            });
        } else {
            fileComponents = (
                <ListGroupItem>
                    <Icon name="info" /> No uploads in progress
                </ListGroupItem>
            );
        }

        const style = {
            marginTop: "15px"
        }

        return (
            <div style={style}>
                <h5>
                    {this.props.header}
                </h5>

                <FlipMove typeName="div" className="list-group">
                    {fileComponents}
                </FlipMove>
            </div>
        );
    }

}