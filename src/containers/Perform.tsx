import React from "react";
import { useSearchParams } from "react-router-dom";
import { useSolidAuth } from "@ldo/solid-react";
import Companion from "./companion/Companion";
import { useAuthentication, useMainContainer } from "../util/hooks";
import WebMidiRecorder from "./midi-recorder";
import { useNavigate } from "react-router";

function LinkToUpload({ uri }: { uri: string }) {
  const navigate = useNavigate();
  return (
    <a
      href={`/upload?score=${uri}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`/upload?score=${uri}`);
      }}
    >
      Upload a performance
    </a>
  );
}

/**
 * The main wrapper to perform a score
 *
 *  - Load the Clara interface, using the score that we downloaded to the user's pod
 */
export default function Perform() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, fetch } = useSolidAuth();
  const {
    isAuthenticated,
    isLoading: authLoading,
    webId,
  } = useAuthentication();
  const {
    mainContainerUri,
    isLoading: containerLoading,
    error,
  } = useMainContainer();
  const score = searchParams.get("score");
  const performance = searchParams.get("performance");
  const handlePerformanceSelected = React.useCallback(
    (performanceId?: string) => {
      const nextParams = new URLSearchParams(searchParams);
      const currentPerformance = nextParams.get("performance");
      if (performanceId) {
        if (performanceId === currentPerformance) {
          return;
        }
        nextParams.set("performance", performanceId);
      } else {
        if (!currentPerformance) {
          return;
        }
        nextParams.delete("performance");
      }
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams],
  );

  if (authLoading) {
    return <p>Checking authentication...</p>;
  }

  if (!isAuthenticated) {
    return <p>You must be logged in</p>;
  }

  if (!score) {
    return <p>Error: "score" parameter must be specified</p>;
  }

  if (containerLoading) {
    return <p>Finding your storage location...</p>;
  }

  if (error) {
    return <p>Error finding your storage location: {error}</p>;
  }

  if (mainContainerUri && score) {
    return (
      <div>
        <LinkToUpload uri={score} />
        <WebMidiRecorder score={score} expansionOptions={[]} />
        <Companion
          uri={score}
          userPOD={mainContainerUri}
          userProfile={webId!}
          fetch={fetch}
          selectedPerformance={performance || undefined}
          onPerformanceSelected={handlePerformanceSelected}
        />
      </div>
    );
  } else {
    return <p>Unable to find your storage location</p>;
  }
}
