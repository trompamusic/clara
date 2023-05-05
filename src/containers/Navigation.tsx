import {Container, Dropdown, FormControl, InputGroup, Nav, Navbar, SplitButton} from "react-bootstrap";
import {
    useSession,
    CombinedDataProvider,
    LogoutButton,
    Text, SessionContext
} from "@inrupt/solid-ui-react";

import { FOAF } from "@inrupt/lit-generated-vocab-common";
import {Link} from "react-router-dom";
import {Button} from 'react-bootstrap';
import React, {useContext, useState} from "react";

const providers = {
    trompa: "https://trompa-solid.upf.edu",
    inrupt: "https://start.inrupt.com"
}

function LoginButton() {
    const [idp, setIdp] = useState(providers.trompa);
    const [showIdpInput, setShowIdpInput] = useState(false);
    const { login, setSessionRequestInProgress } = useContext(SessionContext);

    /**
     * Copied from inrupt/solid-ui-react LoginButton
     */
    async function loginHandler(oidcIssuer: string) {
        const options = {
            redirectUrl: window.location.href,
            oidcIssuer,
        };

        setSessionRequestInProgress(true);

        try {
            await login(options);
            setSessionRequestInProgress(false);
        } catch (error) {
            setSessionRequestInProgress(false);
            // TODO: Log this or report in more detail
            console.error(error);
        }
    }

    return <InputGroup className="mb-3">
        {showIdpInput && <>
            <InputGroup.Text>IDP</InputGroup.Text>
            <FormControl htmlSize={30} aria-label="SOLID IDP" value={idp} onChange={(e) => setIdp(e.target.value)} />
        </>
        }
        <SplitButton id='login-button' title='Login' align="end" onClick={async () => {
            await loginHandler(idp);
        }}>
            <Dropdown.Item onClick={async () => {
                await loginHandler(providers.trompa);
            }}>Login with Trompa</Dropdown.Item>
            <Dropdown.Item onClick={async () => {
                await loginHandler(providers.inrupt);
            }}>Login with inrupt</Dropdown.Item>
            <Dropdown.Item onClick={() => setShowIdpInput(true)}>Choose another provider</Dropdown.Item>
        </SplitButton>
    </InputGroup>
}


export default function Navigation() {
    const {session} = useSession();

    return (
        <Navbar bg="light" expand="lg">
            <Container fluid={true}>
                <Navbar.Brand href="/">Clara</Navbar.Brand>
                <Nav className="me-auto">
                    <Nav.Link as={Link} to="/demo">Demo</Nav.Link>
                </Nav>
                <Nav>
                    {session.info.isLoggedIn
                        ? <><Navbar.Text>
                            <CombinedDataProvider datasetUrl={session.info.webId} thingUrl={session.info.webId}>
                                Logged in: <Text property={FOAF.name.iri.value}/> ({session.info.webId})
                            </CombinedDataProvider>
                        </Navbar.Text>&emsp;
                            <LogoutButton><Button>Log out</Button></LogoutButton>
                        </>
                        : <LoginButton/>
                    }
                </Nav>
            </Container>
        </Navbar>
    );
}
