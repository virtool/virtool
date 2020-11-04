import React from "react";
import { TextArea, Button, MarkdownNotes } from "../../../base";

const getInitialState = ({ notes, isPreview }) => ({
    notes: notes || "",
    isPreview: isPreview || false,
    error: ""
});

export class Notes extends React.Component {
    constructor(props) {
        super(props);
        this.state = getInitialState(this.props);
    }

    handleChange = e => {
        const { name, value } = e.target;
        this.setState({
            [name]: value,
            error: ""
        });
        this.props.onNotesChanges(e);
    };

    handlePreview = e => {
        this.setState({ isPreview: e });
    };

    render() {
        const isPreview = this.state.isPreview;
        const notes = this.state.notes;
        return (
            <div>
                <Button onClick={() => this.handlePreview(false)}>Write</Button>
                <Button onClick={() => this.handlePreview(true)}>Preview</Button>
                {isPreview ? (
                    <MarkdownNotes notes={notes}></MarkdownNotes>
                ) : (
                    <TextArea name="notes" value={notes} onChange={this.handleChange} className="input" />
                )}
            </div>
        );
    }
}
