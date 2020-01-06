import React from "react";
import Enzyme, { shallow, render, mount } from "enzyme";
import Adapter from "enzyme-adapter-react-16";

// Note that enzyme-to-json snapshot serializer is configured in
// jest configuration settings specified in package.json instead of here.

// React 16 Enzyme adapter
Enzyme.configure({ adapter: new Adapter() });

// Globals are defined here to limit import redundancies.
global.shallow = shallow;
global.render = render;
global.mount = mount;
global.React = React;
