import React from "react";
import ReadFileList from "./Files/ReadFileList";
import ReadUploader from "./Files/ReadUploader";

var Flex = require('virtool/js/components/Base/Flex.jsx');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');

var ReadFiles = React.createClass({

    propTypes: {
        route: React.PropTypes.object
    },

    getInitialState: function () {
        return {
            documents: dispatcher.db.files.chain().find({file_type: "reads"})
        };
    },

    componentDidMount: function () {
        dispatcher.db.files.on("change", this.update);
    },

    componentWillUnmount: function () {
        dispatcher.db.files.off("change", this.update);
    },

    update: function () {
        this.setState(this.getInitialState());
    },

    render: function () {

        const readyFiles = this.state.documents.branch().find({ready: true}).data();

        const readyHeader = (
            <span>
                <Icon name="checkmark" /> <strong>Ready</strong>
            </span>
        );

        const uploadingFiles = this.state.documents.branch().find({ready: false}).data();

        let uploadingList;

        if (uploadingFiles.length > 0) {
            const uploadingHeader = (
                <span>
                    <Icon name="meter" /> <strong>In Progress</strong>
                </span>
            );

            uploadingList = <ReadFileList header={uploadingHeader} files={uploadingFiles} />;
        }

        return (
            <div>
                <ReadUploader />
                {uploadingList}
                <ReadFileList header={readyHeader} files={readyFiles} />
            </div>
        );
    }

});

module.exports = ReadFiles;
