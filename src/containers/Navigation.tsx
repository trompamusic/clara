import {Container, Dropdown, FormControl, InputGroup, Nav, Navbar, SplitButton} from "react-bootstrap";

import { FOAF } from "@inrupt/lit-generated-vocab-common";
import {Link} from "react-router-dom";
import {Button} from 'react-bootstrap';
import React, {useState} from "react";
import { useSolidAuth } from "@ldo/solid-react";

const providers = {
    inrupt: "https://login.inrupt.com",
    solidCommunity: "https://solidcommunity.net",
}

function LoginButton() {
    const [idp, setIdp] = useState(providers.solidCommunity);
    const [loginError, setLoginError] = useState<string|null>(null);
    const [showIdpInput, setShowIdpInput] = useState(false);
    const { login } = useSolidAuth();
    const loginOptions = {
        clientId: process.env.REACT_APP_CLIENT_ID,
    }

    return <InputGroup className="mb-3">
        {showIdpInput ? <>
            <InputGroup.Text>IDP</InputGroup.Text>
            <FormControl htmlSize={30} aria-label="SOLID IDP" value={idp} onChange={(e) => setIdp(e.target.value)} />
        </> :
            <InputGroup.Text>{idp}</InputGroup.Text>
        }
        {loginError && <InputGroup.Text>{loginError}</InputGroup.Text>}
        <SplitButton id='login-button' title="Login" toggleLabel={`Login with ${idp}`} align="end" onClick={() => {
            login(idp, loginOptions);
        }}>
            <Dropdown.Item onClick={() => {
                login(providers.inrupt, loginOptions);
            }}>Login with inrupt</Dropdown.Item>
            <Dropdown.Item onClick={() => {
                login(providers.solidCommunity, loginOptions);
            }}>Login with Solid Community</Dropdown.Item>
            <Dropdown.Item onClick={() => {
                setShowIdpInput(true);
                setLoginError(null);
            }}>Choose another provider</Dropdown.Item>
        </SplitButton>
    </InputGroup>
}


export default function Navigation() {
    const { session, logout } = useSolidAuth();
    const webId = session.webId;
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
                    {session.isLoggedIn
                        ? <><Navbar.Text>
                                Logged in: {session.webId}
                        </Navbar.Text>&emsp;
                            <Button onClick={() => logout()}>Log out</Button>
                        </>
                        : <LoginButton/>
                    }
                </Nav>
            </Container>
        </Navbar>
    );
}
