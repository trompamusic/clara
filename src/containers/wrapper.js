import React, { useState, useEffect } from 'react';
import data from '@solid/query-ldflex';
import MIDIMessage from 'midimessage';

import { 
  LoginButton,
  LogoutButton,
  Value, 
  LoggedIn, 
  LoggedOut, 
  useLDflexValue, 
} from '@solid/react';

import Companion from './companion';

const MIDI_TIMEOUT = 5000; // milliseconds until we decide rehearsal rendition has stopped
const MIDI_BATCH_ENDPOINT = "http://127.0.0.1:5000/midiBatch"

export default function Wrapper(props) {
    data.context.extend({
      mo: "http://purl.org/ontology/mo/",
      trompa: "http://vocab.trompamusic.eu/vocab#"
    })
    const performanceCollection = useLDflexValue("user.trompa_hasPerformanceCollection");
    const userPOD = useLDflexValue('user.storage');
    const publicPerformanceCollection = 'https://trompa.solidcommunity.net/public/clara.trompamusic.folder/performanceCollection/SchumannRenditions.ttl';
    const [showPublicDemo, setShowPublicDemo] = useState(false);
    const [midiSupported, setMidiSupported] = useState(false);
    const [midiIn, setMidiIn] = useState([]);
    const [midiEvents, setMidiEvents] = useState([])

    // Initialise Web-MIDI
    useEffect(() => {
      if("requestMIDIAccess" in navigator) { 
        navigator.requestMIDIAccess()
        .then(
          (midi) => { 
              setMidiSupported(true);
              let i = []
              const inputs = midi.inputs.values();
              for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                input.value.addEventListener('midimessage', (mes) => handleMidiMessage(mes));
                i.push(input.value);
              }
              setMidiIn(i);
          },
          (err) => console.log('Something went wrong', err));
      } else { 
        console.warn("Browser does not support WebMIDI");
      }
    }, [])


  // Track MIDI events and start / end rehearsal rendition recordings based on them
  useEffect(() => {
    let timer;
    if(timer) { 
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      if(midiEvents.length) {
        let midiEventsJson = midiEvents.map(m => { return {data: MIDIMessage(m), timestamp: m.timeStamp} });
        console.log("I declare a rehearsal to be complete: ", midiEventsJson);
        fetch(MIDI_BATCH_ENDPOINT, { 
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(midiEventsJson)
        }).then(response => response.json())
        .then(data => console.log("GOT RESPONSE: ", data))
      }
      //TODO do something with midiEvents
      setMidiEvents([]);
    }, MIDI_TIMEOUT)
    return () => clearTimeout(timer)
  }, [midiEvents]);
    
    function handleMidiMessage(mes) { 
      console.log("RAW MIDI MESSAGE: ", mes);
      setMidiEvents(midiEvents => [...midiEvents, mes]);
    }

    return(
      <div id="authWrapper">
          { midiSupported
            ? <div id="midi">
                <span>Please choose your MIDI device: 
                  <select name="midiDevices" id="midiDevices">
                    { midiIn.map(device => <option key={`${device.name}`} value={`${device.name}`}>{`${device.name}`}</option>) }
                  </select>
                </span>
                <span id="recordingIndicator">
                  { midiEvents.length 
                  ? <span className="isRecording">Recording</span>
                  : <span className="isNotRecording">Not Recording</span>
                  }
                </span>
                <div id="midiEvents">
                    {midiEvents.map(ev => <div key={ev.timeStamp}>{ev.data.reverse().join()}</div>)}
                </div>
              </div>
            : <div>MIDI not supported</div>
          }
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
          <p><LogoutButton>Log out</LogoutButton> You are logged in as <Value src="user.name"/></p>
          { typeof userPOD !== "undefined"
           ? <Companion userPOD = { `${userPOD}` } uri = { `${performanceCollection}` } />
           : <div>Loading... </div>
          }
        </LoggedIn>
      </div>
    )
}
