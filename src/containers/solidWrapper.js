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
    const userProfile = useLDflexValue('user');
    const publicPerformanceCollection = 'https://clara.trompa-solid.upf.edu/clara.trompamusic.folder/performanceContainer/SchumannRenditions.jsonld';
    const [showPublicDemo, setShowPublicDemo] = useState(false);

    return(
      <div id="authWrapper">
        <LoggedOut>
          { showPublicDemo
            ? <Companion uri = {  publicPerformanceCollection } userPOD = { `https://clara.trompa-solid.upf.edu/` } />
            : <div>
                <p><button onClick = { () => setShowPublicDemo(true) }>Launch demo</button></p>
                <p><LoginButton popup="auth-popup.html">Log in with Solid</LoginButton></p>
              </div>
          }
        </LoggedOut>
        <LoggedIn>
          <p><LogoutButton>Log out</LogoutButton> You are logged in as <Value src="user.name"/>
          <a href={`${userProfile}`}>
            <img src="/solid-logo.svg" alt="Solid logo" title={`${userProfile}`} width="20" height="20" style={ {verticalAlign:"text-bottom", paddingLeft:"5px", paddingBottom:"1px"} } />
          </a></p>
          { typeof userPOD !== "undefined" && typeof performanceCollection !== "undefined"
           ? <Companion userPOD = { `${userPOD}` } uri = { `${performanceCollection}` } />
           : <div>Loading... </div>
          }
        </LoggedIn>
      </div>
    )
}
