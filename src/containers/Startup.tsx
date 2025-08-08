import React, { useEffect, useState, useCallback } from "react";
import Api from "../util/api";
import { useNavigate, useLocation } from "react-router";
import { useAuthentication } from "../util/hooks";
import { useClaraContainer } from "../util/hooks";

/**
 * Identifies if a user has set up their account
 * (logged in, we have permission to edit, the clara container exists)
 *
 * Once these steps are done, show the interface to select a score to perform
 */
export default function Startup() {
  const [checkingPermission, setCheckingPermission] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [authUrl, setAuthUrl] = useState<string>();
  const { isAuthenticated, isLoading, webId } = useAuthentication();
  const navigate = useNavigate();
  const location = useLocation();

  const { isLoading: claraLoading, error: claraError } = useClaraContainer();

  const setupUser = useCallback(async () => {
    try {
      // Check permissions first
      const permissionData = await Api.checkUserPermissions(webId || "");

      if (permissionData.has_permission === false) {
        // No permission, get auth URL
        const currentPath = `${location.pathname}${location.search}` || "/";
        const authData = await Api.getBackendAuthenticationUrl(
          webId || "",
          currentPath,
        );
        setAuthUrl(authData.auth_url);
        setCheckingPermission(false);
        return;
      }
      // This interacts with Layout.tsx to redirect to /select if the user accessed / initially
      //  (and didn't get here due to a solid auth flow)
      window.dispatchEvent(new Event("clara:permissions-ok"));
      setCheckingPermission(false);
    } catch (e) {
      setPermissionError(true);
      setCheckingPermission(false);
    }
  }, [webId, navigate, location.pathname, location.search]);

  useEffect(() => {
    // Only proceed if the user is authenticated (logged in and auth check completed)
    if (isAuthenticated) {
      setupUser();
    }
  }, [isAuthenticated, setupUser]);

  // Handle CLARA container errors
  useEffect(() => {
    if (claraError) {
      console.error("CLARA container error:", claraError);
      setPermissionError(true);
      setCheckingPermission(false);
    }
  }, [claraError]);

  if (isLoading) {
    return <p>Checking authentication...</p>;
  }

  if (!isAuthenticated) {
    return <p>You must be logged in</p>;
  }

  if (checkingPermission) {
    return <p>Checking if you have let us store items in your Solid pod...</p>;
  } else if (permissionError) {
    return (
      <p>
        There was an error checking your permissions. We have been informed of
        the error and are looking into it
      </p>
    );
  } else if (claraLoading) {
    return <p>Permission granted, setting up your workspace...</p>;
  } else {
    let message = <>Please wait... retrieving authentication URL</>;
    if (authUrl) {
      message = (
        <>
          Please visit the <a href={authUrl}>Authentication page</a> to do this
        </>
      );
    }
    return (
      <p>
        You haven't given permission for us to act on your behalf <br />
        {message}
      </p>
    );
  }
}
