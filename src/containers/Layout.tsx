import Navigation from "./Navigation";
import React from "react";
import {Outlet} from "react-router";
import {Container} from "react-bootstrap";
import {
    BrowserSolidLdoProvider,
  } from "@ldo/solid-react";
import Footer from "./Footer";

export default function Layout() {
    return <BrowserSolidLdoProvider>
        <Navigation />
        <Container fluid="lg">
            <Outlet />
        </Container>
        <Footer />
    </BrowserSolidLdoProvider>
}
