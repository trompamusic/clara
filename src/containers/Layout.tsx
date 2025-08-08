import Navigation from "./Navigation";
import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Container, Spinner, Row, Col } from "react-bootstrap";
import { BrowserSolidLdoProvider, useSolidAuth } from "@ldo/solid-react";
import { bindActionCreators } from "redux";
import Footer from "./Footer";
import { useDispatch, useSelector } from "react-redux";
import { setFetchFunction } from "meld-clients-core/lib/actions";

function LayoutContent() {
  const { session, fetch, ranInitialAuthCheck } = useSolidAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [routerReady, setRouterReady] = useState(false);
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

  // Sync React Router with the URL restored by ldo/solid-react.
  // solid-react calls handleIncomingRedirect() and then uses window.history.replaceState
  // to restore PRE_REDIRECT_URI. replaceState doesn't notify React Router, so we realign
  // the router once after ranInitialAuthCheck completes to avoid rendering children on
  // a stale route.
  useEffect(() => {
    if (!ranInitialAuthCheck) return;
    const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const current = `${location.pathname}${location.search}${location.hash}`;
    if (target !== current) {
      navigate(target, { replace: true });
    }
    setRouterReady(true);
  }, [
    ranInitialAuthCheck,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  // If permissions have been checked and granted, and we're on the home route, redirect to /select here
  useEffect(() => {
    if (!routerReady) return;
    if (window.location.pathname !== "/") return;
    const onPermOk = () => {
      if (window.location.pathname === "/") {
        navigate("/select", { replace: true });
      }
    };
    window.addEventListener("clara:permissions-ok", onPermOk);
    return () => {
      window.removeEventListener("clara:permissions-ok", onPermOk);
    };
  }, [routerReady, navigate]);

  // Show loading while authentication is being checked, router is syncing, or while initializing Clara
  const shouldShowLoading =
    !ranInitialAuthCheck ||
    !routerReady ||
    (session.isLoggedIn && !fetchFunctionInStore);

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
              <p className="mt-3">
                {!ranInitialAuthCheck
                  ? "Checking authentication..."
                  : "Initializing Clara..."}
              </p>
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
