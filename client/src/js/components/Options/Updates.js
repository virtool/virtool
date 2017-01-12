/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UpdateOptions
 */

import React from "react";
import SettingsProvider from "./SettingsProvider";
import SoftwareUpdate from "./Updates/Software";

const getState = () => ({
    updates: dispatcher.db.updates.chain().branch()
});


/**
 * A component the contains child components that modify certain general options. A small explanation of each
 * subcomponent is also rendered.
 */
export class UpdateOptionsInner extends React.Component {

    constructor (props) {
        super(props);
        this.state = getState();
    }

    static propTypes = {
        set: React.PropTypes.func,
        settings: React.PropTypes.object
    };

    componentDidMount () {
        dispatcher.db.updates.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.db.updates.off("change", this.update);
    }

    update = () => {
        this.setState(getState());
    };

    render () {
        return (
            <div>
                <SoftwareUpdate updates={this.state.updates} {...this.props} />
            </div>
        );
    }

}

const UpdateOptions = () => (
    <SettingsProvider>
        <UpdateOptionsInner/>
    </SettingsProvider>
);

export default UpdateOptions;
