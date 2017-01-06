import React from "react";

const getState = () => ({
    settings: dispatcher.settings.data
});

export default class SettingsProvider extends React.Component {

    constructor (props) {
        super(props);
        this.state = getState();
    }

    static propTypes = {
        children: React.PropTypes.node
    };

    componentDidMount () {
        dispatcher.settings.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.settings.off("change", this.update);
    }

    update = () => {
        this.setState(getState());
    };

    render = () => (
        <div>
            {React.cloneElement(this.props.children, {settings: this.state.settings, set: dispatcher.settings.set})}
        </div>
    )
}
