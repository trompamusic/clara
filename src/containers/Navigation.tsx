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
    inrupt: "https://login.inrupt.com",
    solidCommunity: "https://solidcommunity.net",
}

function LoginButton() {
    const [idp, setIdp] = useState(providers.trompa);
    const [loginError, setLoginError] = useState<string|null>(null);
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
        setLoginError(null);
        setSessionRequestInProgress(true);

        try {
            await login(options);
            setSessionRequestInProgress(false);
        } catch (error) {
            setSessionRequestInProgress(false);
            // TODO: Log this or report in more detail
            setLoginError("Unable to log in with this provider.");
            console.error(error);
        }
    }

    return <InputGroup className="mb-3">
        {showIdpInput && <>
            <InputGroup.Text>IDP</InputGroup.Text>
            <FormControl htmlSize={30} aria-label="SOLID IDP" value={idp} onChange={(e) => setIdp(e.target.value)} />
        </>
        }
        {loginError && <InputGroup.Text>{loginError}</InputGroup.Text>}
        <SplitButton id='login-button' title='Login' align="end" onClick={async () => {
            await loginHandler(idp);
        }}>
            <Dropdown.Item onClick={async () => {
                await loginHandler(providers.trompa);
            }}>Login with Trompa</Dropdown.Item>
            <Dropdown.Item onClick={async () => {
                await loginHandler(providers.inrupt);
            }}>Login with inrupt</Dropdown.Item>
            <Dropdown.Item onClick={async () => {
                await loginHandler(providers.solidCommunity);
            }}>Login with Solid Community</Dropdown.Item>
            <Dropdown.Item onClick={() => {
                setShowIdpInput(true);
                setLoginError(null);
            }}>Choose another provider</Dropdown.Item>
        </SplitButton>
    </InputGroup>
}


export default function Navigation() {
    const {session} = useSession();
    const webId = session.info.webId;
    return (
        <Navbar bg="light" expand="lg">
            <Container fluid={true}>
                <Navbar.Brand>Clara</Navbar.Brand>
                <Nav className="me-auto">
                    <Nav.Link as={Link} to="/" onClick={(e) => {
                        // Because the clara/meld interface stores state of a loaded score and it can't
                        //  currently be reset, reload the app completely to load a new score
                        e.preventDefault();
                        window.open("/", "_self");
                    }}>Home</Nav.Link>
                    <Nav.Link as={Link} to="/demo">Demo</Nav.Link>
                </Nav>
                <Nav>
                    {session.info.isLoggedIn
                        ? <><Navbar.Text>
                            <CombinedDataProvider datasetUrl={webId!} thingUrl={webId!}>
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
