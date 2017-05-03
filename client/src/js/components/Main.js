import React from "react";
import Nav from "./Nav/Bar";

const Main = () => (
    <div id="app" style={{display: "flex", flexFlow: "column nowrap"}}>
        <Nav style={{flex: "0 0 auto"}} />
        <div style={{flex: "1 0 auto"}}>
            <div className="container-fluid" id="content-display" style={{flex: "1 0 auto"}}>
                <this.state.route.baseComponent route={this.state.route} />
            </div>
        </div>
    </div>
);

export default Main;
