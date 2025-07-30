import Navigation from "./Navigation";
import React, { useEffect } from "react";
import { Outlet } from "react-router";
import { Container, Spinner, Row, Col } from "react-bootstrap";
import { BrowserSolidLdoProvider, useSolidAuth } from "@ldo/solid-react";
import { bindActionCreators } from "redux";
import Footer from "./Footer";
import { useDispatch, useSelector } from "react-redux";
import { setFetchFunction } from "meld-clients-core/lib/actions";

function LayoutContent() {
  const { session, fetch } = useSolidAuth();
  const dispatch = useDispatch();

  // We use bindActionCreators to automatically dispatch actions - this is also done in the companion component
  // by wrapping the class component
  const boundActions = bindActionCreators({ setFetchFunction }, dispatch);
  const fetchFunctionInStore = useSelector(
    (state: any) => state.sessionControl.fetchFunction,
  );

  // Get ldo/solid-react's logged-in-session and put `fetch` into the Redux state
  // While waiting for the session to be logged in, we show a loading spinner instead of the app
  useEffect(() => {
    if (session.isLoggedIn && fetch) {
      boundActions.setFetchFunction(fetch);
    }
  }, [session.isLoggedIn, fetch, boundActions]);

  const shouldShowLoading = session.isLoggedIn && !fetchFunctionInStore;

  return (
    <>
      <Navigation />
      <Container fluid="lg">
        {shouldShowLoading ? (
          <Row
            className="justify-content-center align-items-center"
            style={{ minHeight: "60vh" }}
          >
            <Col xs="auto" className="text-center">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-3">Initializing Clara...</p>
            </Col>
          </Row>
        ) : (
          <Outlet />
        )}
      </Container>
      <Footer />
    </>
  );
}

export default function Layout() {
  return (
    <BrowserSolidLdoProvider>
      <LayoutContent />
    </BrowserSolidLdoProvider>
  );
}
