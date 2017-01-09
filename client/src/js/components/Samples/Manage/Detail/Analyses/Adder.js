import React from "react";
import { AlgorithmSelect, FlexItem, Input, Button } from "virtool/js/components/Base";

const getInitialState = () => ({
    name: "",
    algorithm: "pathoscope_bowtie",
    pending: false
});

export default class AnalysisAdder extends React.Component {

    constructor (props) {
        super(props);
        this.state = getInitialState();
    }

    static propTypes = {
        sampleId: React.PropTypes.string.isRequired,
        setProgress: React.PropTypes.func
    };

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.props.setProgress(true);

        dispatcher.db.samples.request("analyze", {
            samples: [this.props.sampleId],
            algorithm: this.state.algorithm,
            name: this.state.name || null
        })
        .success(() => {
            this.props.setProgress(false);
            this.setState(getInitialState());
        })
        .failure(() => {
            this.props.setProgress(false);
            this.setState(getInitialState());
        });
    };

    render = () => (
        <form onSubmit={this.handleSubmit}>
            <div className="toolbar">
                <FlexItem grow={1}>
                    <Input
                        placeholder="Analysis Name"
                        value={this.state.nickname}
                        onChange={this.handleChange}
                        disabled={true}
                    />
                </FlexItem>

                <AlgorithmSelect value={this.state.algorithm} onChange={this.handleChange} noLabel />

                <Button
                    type="submit"
                    bsStyle="primary"
                    icon="new-entry"
                >
                    Create
                </Button>
            </div>
        </form>
    );
}
