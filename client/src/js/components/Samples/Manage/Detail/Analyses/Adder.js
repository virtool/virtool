import React from "react";
import { Flex, FlexItem, Icon, Input, Button } from "virtool/js/components/Base";

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
            <Flex alignItems="flex-end">
                <FlexItem grow={5}>
                    <Input
                        name="nickname"
                        label="Name"
                        value={this.state.nickname}
                        onChange={this.handleChange}
                        disabled={true}
                    />
                </FlexItem>
                <FlexItem grow={1} pad>
                    <Input name="algorithm" type="select" label="Algorithm" value={this.state.algorithm}
                           onChange={this.handleChange}>
                        <option value="pathoscope_bowtie">PathoscopeBowtie</option>
                        <option value="pathoscope_snap">PathoscopeSNAP</option>
                        <option value="nuvs">NuVs</option>
                    </Input>
                </FlexItem>
                <FlexItem pad>
                    <Button type="submit" style={{marginBottom: "15px"}} bsStyle="primary">
                        <Icon name="new-entry" pending={this.state.pending}/> Create
                    </Button>
                </FlexItem>
            </Flex>
        </form>
    );
}
