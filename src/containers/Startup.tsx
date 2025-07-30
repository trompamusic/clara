import React, { useEffect, useState, useCallback } from "react";
import Api from "../util/api";
import { useNavigate } from "react-router";
import { useSolidAuth } from "@ldo/solid-react";
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
  const { session } = useSolidAuth();
  const navigate = useNavigate();

  const webId = session.webId ?? "";

  const {
    claraContainer,
    isLoading: claraLoading,
    error: claraError,
  } = useClaraContainer();

  const setupUser = useCallback(
    async (ignore: boolean) => {
      try {
        // Check permissions first
        const permissionData = await Api.checkUserPermissions(webId);

        if (ignore) return;

        if (permissionData.has_permission === false) {
          // No permission, get auth URL
          const authData = await Api.getBackendAuthenticationUrl(webId, "/");
          if (!ignore) {
            setAuthUrl(authData.auth_url);
          }
          setCheckingPermission(false);
          return;
        }
        if (!ignore) {
          navigate(`/select`);
        }
      } catch (e) {
        if (!ignore) {
          setPermissionError(true);
          setCheckingPermission(false);
        }
      }
    },
    [webId, navigate],
  );

  useEffect(() => {
    if (session.isLoggedIn) {
      let ignore = false;
      setupUser(ignore);
      return () => {
        ignore = true;
      };
    }
  }, [session.isLoggedIn, setupUser]);

  // Handle CLARA container errors
  useEffect(() => {
    if (claraError) {
      console.error("CLARA container error:", claraError);
      setPermissionError(true);
      setCheckingPermission(false);
    }
  }, [claraError]);

  if (!session.isLoggedIn) {
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
