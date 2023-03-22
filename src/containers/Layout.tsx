import Navigation from "./Navigation";
import React from "react";
import {Outlet, useNavigate} from "react-router";
import {Container} from "react-bootstrap";
import {SessionProvider} from "@inrupt/solid-ui-react";

export default function Layout() {

    let navigate = useNavigate();
    const onSessionRestore = (url: any) => {
        if(navigate) {
            const u = new URL(url);
            navigate(u.pathname + u.search);
        }
    }

    return <SessionProvider onError={console.log} restorePreviousSession onSessionRestore={onSessionRestore}>
        <Navigation />
        <Container fluid="lg">
            <Outlet />
        </Container>
    </SessionProvider>
}