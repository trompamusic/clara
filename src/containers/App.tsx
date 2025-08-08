import "bootstrap/dist/css/bootstrap.min.css";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import React from "react";
import RouterError from "./RouterError";
import Layout from "./Layout";
import Companion from "./companion/Companion";
import Startup from "./Startup";
import Perform from "./Perform";
import ScoreSelector from "./ScoreSelector";
import Add from "./Add";
import AuthCallback from "./AuthCallback";
import AddWait from "./AddWait";
import Upload from "./Upload";
import UploadWait from "./UploadWait";
import EditScore from "./EditScore";

const publicPerformanceCollection =
  "https://clara.trompa-solid.upf.edu/clara.trompamusic.folder/performanceContainer/SchumannRenditions.jsonld";
const publicUserProfile = "https://clara.trompa-solid.upf.edu/profile/card#me";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouterError />,
    children: [
      {
        path: "/",
        element: <Startup />,
      },
      {
        path: "/select",
        element: <ScoreSelector />,
      },
      {
        path: "/add",
        element: <Add />,
      },
      {
        path: "/addwait",
        element: <AddWait />,
      },
      {
        path: "/upload",
        element: <Upload />,
      },
      {
        path: "/uploadwait",
        element: <UploadWait />,
      },
      {
        path: "/perform",
        element: <Perform />,
      },
      {
        path: "/demo",
        element: (
          <Companion
            uri={publicPerformanceCollection}
            userPOD={`https://clara.trompa-solid.upf.edu/`}
            userProfile={publicUserProfile}
            demo
          />
        ),
      },
      {
        path: "/auth/callback",
        element: <AuthCallback />,
      },
      {
        path: "/editscore",
        element: <EditScore />,
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
