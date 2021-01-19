import React, { useState } from 'react';
import data from '@solid/query-ldflex';

import { 
  LoginButton,
  LogoutButton,
  Value, 
  LoggedIn, 
  LoggedOut, 
  useLDflexValue, 
} from '@solid/react';

import Companion from './companion';

export default function SolidWrapper(props) {
    data.context.extend({
      mo: "http://purl.org/ontology/mo/",
      trompa: "http://vocab.trompamusic.eu/vocab#"
    })
    const performanceCollection = useLDflexValue("user.trompa_hasPerformanceCollection");
    const userPOD = useLDflexValue('user.storage');
    const publicPerformanceCollection = 'https://trompa.solidcommunity.net/public/clara.trompamusic.folder/performanceCollection/SchumannRenditions.ttl';
    const [showPublicDemo, setShowPublicDemo] = useState(false);

    return(
      <div id="authWrapper">
        <LoggedOut>
          { showPublicDemo
            ? <Companion uri = { publicPerformanceCollection } />
            : <div>
                <p><button onClick = { () => setShowPublicDemo(true) }>Launch demo</button></p>
                <p><LoginButton popup="auth-popup.html">Log in with Solid</LoginButton></p>
              </div>
          }
        </LoggedOut>
        <LoggedIn>
          <p><LogoutButton>Log out</LogoutButton> You are logged in as <Value src="user.name"/> (<Value src="user"/>)</p>
          { typeof userPOD !== "undefined" && typeof performanceCollection !== "undefined"
           ? <Companion userPOD = { `${userPOD}` } uri = { `${performanceCollection}` } />
           : <div>Loading... </div>
          }
        </LoggedIn>
      </div>
    )
}
