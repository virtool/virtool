import "@testing-library/jest-dom";
import "jest-styled-components";
import { fireEvent, render as rtlRender } from "@testing-library/react";
import Enzyme, { mount, render, shallow } from "enzyme";
import Adapter from "enzyme-adapter-react-16";
import React from "react";
import { ThemeProvider } from "styled-components";
import { theme } from "../js/app/theme";

// React 16 Enzyme adapter

// Note that enzyme-to-json snapshot serializer is configured in
// jest configuration settings specified in package.json instead of here.
Enzyme.configure({ adapter: new Adapter() });

const renderWithProviders = ui => rtlRender(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// Globals are defined here to limit import redundancies.
global.fireEvent = fireEvent;
global.mount = mount;
global.React = React;
global.render = render;
global.renderWithProviders = renderWithProviders;
global.shallow = shallow;
