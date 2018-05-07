import React from "react";
import Dropzone from "react-dropzone";
import { Button } from "./index";

export class UploadBar extends React.Component {

    render () {

        return (
            <div className="toolbar" style={this.props.style}>
                <Dropzone
                    ref={(node) => this.dropzone = node}
                    onDrop={this.props.onDrop}
                    className="dropzone"
                    activeClassName="dropzone-active"
                    disableClick
                >
                    Drag file here to upload
                </Dropzone>
        
                <Button icon="folder-open" onClick={() => this.dropzone.open()} />
            </div>
        ); 
    }
}
