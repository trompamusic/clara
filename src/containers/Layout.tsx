import Navigation from "./Navigation";
import React from "react";
import {Outlet, useNavigate} from "react-router";
import {Container} from "react-bootstrap";
import {
    BrowserSolidLdoProvider,
  } from "@ldo/solid-react";
import Footer from "./Footer";

export default function Layout() {

    let navigate = useNavigate();
    const onSessionRestore = (url: any) => {
        if(navigate) {
            const u = new URL(url);
            navigate(u.pathname + u.search);
        }
    }

    return <BrowserSolidLdoProvider>
        <Navigation />
        <Container fluid="lg">
            <Outlet />
        </Container>
        <Footer />
    </BrowserSolidLdoProvider>
}
