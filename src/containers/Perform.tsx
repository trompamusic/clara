import React from "react";
import { useSearchParams } from "react-router-dom";
import { useSolidAuth } from "@ldo/solid-react";
import Companion from "./companion";
import { useMainContainer } from "../util/hooks";
import WebMidiRecorder from "./WebMidiRecorder";
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
  const [searchParams] = useSearchParams();
  const { session, fetch } = useSolidAuth();
  const score = searchParams.get("score");

  // Use the LDO-based hook to get the user's main storage container
  const { mainContainerUri, isLoading, error } = useMainContainer();

  if (!session.isLoggedIn) {
    return <p>Checking if you're logged in...</p>;
  }

  if (!score) {
    return <p>Error: "score" parameter must be specified</p>;
  }

  if (isLoading) {
    return <p>Finding your storage location...</p>;
  }

  if (error) {
    return <p>Error finding your storage location: {error}</p>;
  }

  if (mainContainerUri && score) {
    return (
      <div>
        <LinkToUpload uri={score} />
        <WebMidiRecorder score={score} />
        <Companion
          uri={score}
          userPOD={mainContainerUri}
          userProfile={session.webId!}
          fetch={fetch}
        />
      </div>
    );
  } else {
    return <p>Unable to find your storage location</p>;
  }
}
