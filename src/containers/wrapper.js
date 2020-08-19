import React, { useState, useEffect } from 'react';
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

export default function Wrapper(props) {
    data.context.extend({
      mo: "http://purl.org/ontology/mo/",
      trompa: "http://vocab.trompamusic.eu/vocab#"
    })
    const performanceCollection = useLDflexValue("user.trompa_hasPerformanceCollection");
    const userPOD = useLDflexValue('user.storage');
    const publicPerformanceCollection = 'https://trompa.solid.community/public/clara.trompamusic.folder/performanceCollection/SchumannRenditions.ttl';
    const [showPublicDemo, setShowPublicDemo] = useState(false);
    const [midiSupported, setMidiSupported] = useState(false);
    const [midiIn, setMidiIn] = useState([]);

    // Web-MIDI
    useEffect(() => {
      if("requestMIDIAccess" in navigator) { 
        navigator.requestMIDIAccess()
        .then(
          (midi) => { 
              setMidiSupported(true);
              let i = []
              const inputs = midi.inputs.values();
              for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
                i.push(input.value);
              }
              setMidiIn(i);
          },
          (err) => console.log('Something went wrong', err));
      } else { 
        console.warn("Browser does not support WebMIDI");
      }
    }, [])



    return(
      <div id="authWrapper">
        { midiSupported
          ? <div>{ midiIn.map(device => `${device.name}`).join('') }</div>
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
/*
function connect() {
  if("requestMIDIAccess" in navigator) { 
    navigator.requestMIDIAccess()
    .then(
      (midi) => console.log("got midi: ", midi), // midiReady(midi),
      (err) => console.log('Something went wrong', err));
  } else { 
    console.warn("Browser does not support WebMIDI");
  }
}

function midiReady(midi) {
  // Also react to device changes.
  midi.addEventListener('statechange', (event) => initDevices(event.target));
  initDevices(midi); // see the next section!
}

function initDevices(midi) {
  // Reset.
  let [midiIn, setMidiIn]  = useState([]);
//  let [midiOut, setMidiOut]  = useState([]);

  // MIDI devices that send you data.
  const inputs = midi.inputs.values();
  for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
    setMidiIn([...midiIn, input.value]); 
  }
  // MIDI devices that you send data to.
  const outputs = midi.outputs.values();
  for (let output = outputs.next(); output && !output.done; output = outputs.next()) {
    midiOut.push(output.value);
  }
  displayDevices();
//  startListening();
}

function displayDevices() { 
  let [midiIn, setMidiIn]  = useState([]);
  console.log("Display devices! Midi in: ", midiIn);
}

// Start listening to MIDI messages.
function startListening() {
  for (const input of midiIn) {
    input.addEventListener('midimessage', midiMessageReceived);
  }
}

function midiMessageReceived(event) {
  // MIDI commands we care about. See
  // http://webaudio.github.io/web-midi-api/#a-simple-monophonic-sine-wave-midi-synthesizer.
  const NOTE_ON = 9;
  const NOTE_OFF = 8;

  const cmd = event.data[0] >> 4;
  const pitch = event.data[1];
  const velocity = (event.data.length > 2) ? event.data[2] : 1;

  // You can use the timestamp to figure out the duration of each note.
  const timestamp = Date.now();

  // Note that not all MIDI controllers send a separate NOTE_OFF command for every NOTE_ON.
  if (cmd === NOTE_OFF || (cmd === NOTE_ON && velocity === 0)) {
    console.log(`🎧 from ${event.srcElement.name} note off: pitch:${pitch}, velocity: ${velocity}`);

    // Complete the note!
    const note = notesOn.get(pitch);
    if (note) {
      console.log(`🎵 pitch:${pitch}, duration:${timestamp - note} ms.`);
      notesOn.delete(pitch);
    }
  } else if (cmd === NOTE_ON) {
    console.log(`🎧 from ${event.srcElement.name} note off: pitch:${pitch}, velocity: {velocity}`);

    // One note can only be on at once.
    notesOn.set(pitch, timestamp);
  }
}*/
