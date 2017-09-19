/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import Dropzone from "react-dropzone";
import Request from "superagent";

export default class VirusImport extends React.Component {

    constructor (props) {
        super(props);
    }

    onDrop = (files) => {
        const file = files[0];

        Request.post("/upload/viruses")
            .query({name: file.name})
            .attach("file", file)
            .end();
    };

    render () {
        return (
            <div>
                <h3 className="view-header">
                    <strong>
                        Import Viruses
                    </strong>
                </h3>

                <Dropzone className="dropzone" onDrop={this.onDrop}>
                    <div className="clearfix">
                        First, upload a <strong>viruses.json.gz</strong> file. Drag it here or click to upload.
                    </div>
                </Dropzone>
            </div>
        );
    }

}


