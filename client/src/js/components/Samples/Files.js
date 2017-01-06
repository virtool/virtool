import React from "react";
import { Icon } from "virtool/js/components/Base";

import ReadFileList from "./Files/ReadFileList";
import ReadUploader from "./Files/ReadUploader";

const getFiles = () => dispatcher.db.files.chain().find({file_type: "reads"});

export default class ReadFiles extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            documents: getFiles()
        };
    }

    static propTypes = {
        route: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.files.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.files.off("change", this.update);
    }

    update = () => {
        this.setState({
            documents: getFiles()
        });
    };

    render () {

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

}
