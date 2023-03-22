import Wrapper from "./wrapper";
import 'bootstrap/dist/css/bootstrap.min.css';

import {
    createBrowserRouter,
    RouterProvider,
} from "react-router-dom";
import React from "react";
import RouterError from "./RouterError";
import Layout from "./Layout";
import Companion from "./companion";

const publicPerformanceCollection = 'https://clara.trompa-solid.upf.edu/clara.trompamusic.folder/performanceContainer/SchumannRenditions.jsonld';
const publicUserProfile = 'https://clara.trompa-solid.upf.edu/profile/card#me';

const router = createBrowserRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <RouterError />,
        children: [
            {
                path: "/",
                element: <Wrapper />
            },
            {
                path: "/demo",
                element: <Companion uri={publicPerformanceCollection} userPOD={`https://clara.trompa-solid.upf.edu/`}
                                    userProfile={publicUserProfile} demo/>
            }
        ]
    },
]);

export default function App() {
    return <RouterProvider router={router} />
}