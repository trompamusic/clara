import React, {createRef, DOMAttributes, useEffect, useState} from "react";
import {useSession} from "@inrupt/solid-ui-react";
import {blobToNoteSequence, NoteSequence} from "@magenta/music";
import {PlayerElement} from 'html-midi-player';
import {createComponent, EventName} from "@lit-labs/react";

// Wrap the <midi-player> web component in a React class that also handles events.
const MidiPlayerElement = createComponent({
    tagName: 'midi-player',
    elementClass: PlayerElement,
    react: React,
    events: {
        onNote: 'note' as EventName<CustomEvent>,
    },
});


interface MidiPlayerProps {
    url: string
    onNote: (note: NoteSequence.Note) => void
}

export function MidiPlayer({url, onNote}: MidiPlayerProps) {
    const {session} = useSession();
    const [notes, setNotes] = useState<NoteSequence | null>(null);

    useEffect(() => {
        let ignore = false;

        if (session.info.isLoggedIn && url) {
            // This is the same as magenta's urlToNoteSequence, but uses an authenticated SOLID fetch
            session.fetch(url)
                .then((response) => {
                    return response.blob();
                })
                .then((blob) => {
                    return blobToNoteSequence(blob);
                }).then(notes => {
                    if (!ignore) {
                        setNotes(notes);
                    }
                })
            return () => {
                ignore = true;
            };
        }
    }, [url, session]);

    if (!session.info.isLoggedIn) {
        return <p>waiting to log in...</p>
    }

    if (!notes) {
        return <p>loading...</p>
    }

    return (
        <div id="midi-player">
            <MidiPlayerElement
                noteSequence={notes}
                soundFont="https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus"
                onNote={(e) => {
                    console.log(e.detail);
                    // TODO: By sending an event back to the parent component, that component is re-rendering
                    //  causing this player to be re-created, which causes the player to restart.
                    //onNote(e.detail.note);
                }}>
            </MidiPlayerElement>
        </div>
    );
}
