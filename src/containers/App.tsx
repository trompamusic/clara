import "bootstrap/dist/css/bootstrap.min.css";

import { createBrowserRouter, RouterProvider } from "react-router-dom";
import React from "react";
import RouterError from "./RouterError";
import Layout from "./Layout";
import Companion from "./companion/Companion";
import Startup from "./Startup";
import Perform from "./Perform";
import ScoreSelector from "./ScoreSelector";
import AuthCallback from "./AuthCallback";
import AddWait from "./AddWait";
import Upload from "./Upload";
import UploadWait from "./UploadWait";
import EditScore from "./EditScore";

const publicPerformanceCollection =
  "https://storage.inrupt.com/8e7d2ff0-be9c-4430-95b8-5a0370bf2942/clara.trompamusic.folder/performanceContainer/SchumannRenditions.jsonld";
const publicUserProfile = "https://id.inrupt.com/clara";

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
            userPOD={`https://storage.inrupt.com/8e7d2ff0-be9c-4430-95b8-5a0370bf2942/`}
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
