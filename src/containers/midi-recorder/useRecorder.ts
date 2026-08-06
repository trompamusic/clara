import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MessageEvent } from "webmidi";
import Api from "../../util/api";
import { createPerformanceLabel } from "../../util/date";
import { encodeMidi, eventsToMidi, midiStringToBlob } from "../../util/midi";
import {
  isNoteOffMessage,
  isNoteOnMessage,
  isSystemMessage,
} from "../../util/midiEvents";
import {
  FileDraft,
  Metadata,
  StopReason,
  StoredPerformance,
  TakeDraft,
  Workflow,
} from "./types";
import { NO_EXPANSION, toApiExpansion } from "./PerformanceMetadataFields";

const MIDI_TIMEOUT = 5000;
const emptyMetadata = { label: "", expansion: NO_EXPANSION };

function recover(key: string): Workflow {
  try {
    const take: StoredPerformance | null = JSON.parse(
      localStorage.getItem(key) ?? "null",
    );
    if (take)
      return {
        phase: "takeReview",
        draft: { kind: "take", take, recovered: true, ...emptyMetadata },
        error: null,
        confirmingDiscard: false,
      };
  } catch (error) {
    console.warn("Could not read saved recording:", error);
  }
  return { phase: "ready" };
}

function persist(key: string, take: StoredPerformance | null) {
  try {
    if (take) localStorage.setItem(key, JSON.stringify(take));
    else localStorage.removeItem(key);
  } catch (error) {
    console.warn("Could not save recording:", error);
  }
}

export default function useRecorder(
  webId: string,
  score: string,
  deviceId: string | null,
  navigate: (url: string) => void,
) {
  // Perform keys the recorder by this same user/score pair. Storage is read
  // once on entry; a failed write never changes the in-memory workflow.
  const storageKey = `at.ac.mdw.trompa-midiPerformance-${webId}-${score}`;
  const [state, setState] = useState<Workflow>(() => recover(storageKey));
  const current = useRef<Workflow | null>(state);

  // Native MIDI, timers and deferred drops all go through this one synchronous
  // transition. The ref is current even before React renders the next snapshot;
  // there are no separate capture or upload locks to keep in sync.
  const transition = useCallback((next: Workflow) => {
    if (!current.current) return;
    current.current = next;
    setState(next);
  }, []);

  useLayoutEffect(
    () => () => {
      current.current = null;
    },
    [],
  );

  const handleMidiMessage = useCallback(
    (message: MessageEvent) => {
      const previous = current.current;
      if (
        !deviceId ||
        !previous ||
        (previous.phase !== "ready" && previous.phase !== "recording")
      )
        return;
      const data = message.data;
      const [status, pitch, velocity] = data;
      if (isSystemMessage(status)) return;
      const noteOn = isNoteOnMessage(status, velocity);
      const noteOff = isNoteOffMessage(status, velocity);
      if (previous.phase === "ready" && !noteOn) return;
      const now = Date.now();
      const recording =
        previous.phase === "recording"
          ? previous
          : {
              startedAt: now,
              lastNoteEventAt: now,
              deviceId,
              heldCounts: {} as Record<number, number>,
              heldTotal: 0,
              events: [],
            };
      let heldCounts = recording.heldCounts;
      let heldTotal = recording.heldTotal;
      if (noteOn) {
        heldCounts = { ...heldCounts, [pitch]: (heldCounts[pitch] ?? 0) + 1 };
        heldTotal++;
      } else if (noteOff && (heldCounts[pitch] ?? 0) > 0) {
        heldCounts = { ...heldCounts, [pitch]: heldCounts[pitch] - 1 };
        heldTotal--;
      }
      transition({
        ...recording,
        phase: "recording",
        heldCounts,
        heldTotal,
        lastNoteEventAt: noteOn || noteOff ? now : recording.lastNoteEventAt,
        events: [...recording.events, { data, timeStamp: now }],
      });
    },
    [deviceId, transition],
  );

  const finalise = useCallback(
    (reason: StopReason) => {
      const recording = current.current;
      if (recording?.phase !== "recording") return;
      const now = Date.now();
      const midi = eventsToMidi(recording.events, now);
      if (!midi) {
        transition({ phase: "ready" });
        return;
      }
      const take = {
        midiData: encodeMidi(midi),
        recordedAt: new Date(recording.startedAt).toISOString(),
      };
      transition({
        phase: "takeCountdown",
        deadline: now + MIDI_TIMEOUT,
        reason,
        draft: { kind: "take", take, recovered: false, ...emptyMetadata },
      });
      persist(storageKey, take);
    },
    [storageKey, transition],
  );

  useEffect(() => {
    if (state.phase !== "recording" || state.heldTotal > 0) return;
    const timer = setTimeout(
      () => {
        const latest = current.current;
        if (
          latest?.phase === "recording" &&
          latest.heldTotal === 0 &&
          Date.now() >= latest.lastNoteEventAt + MIDI_TIMEOUT
        )
          finalise("silence");
      },
      Math.max(0, state.lastNoteEventAt + MIDI_TIMEOUT - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state, finalise]);

  useEffect(() => {
    if (state.phase === "recording" && state.deviceId !== deviceId)
      finalise("deviceChanged");
  }, [state, deviceId, finalise]);

  const upload = useCallback(
    async (draft: TakeDraft | FileDraft, payload: Blob) => {
      transition({ phase: "uploading", draft });
      const label =
        draft.label.trim() ||
        createPerformanceLabel(
          draft.kind === "take" ? new Date(draft.take.recordedAt) : undefined,
        );
      try {
        const result = await Api.alignMidi(
          webId,
          score,
          payload,
          label,
          toApiExpansion(draft.expansion),
        );
        if (!current.current) return;
        if (draft.kind === "take") persist(storageKey, null);
        navigate(`/uploadwait?task=${result.task_id}&score=${score}`);
      } catch (error) {
        if (!current.current) return;
        console.error("Upload failed:", error);
        const message = "Failed to upload performance. Please try again.";
        transition(
          draft.kind === "take"
            ? {
                phase: "takeReview",
                draft,
                error: message,
                confirmingDiscard: false,
              }
            : {
                phase: "fileSelect",
                draft: { ...draft, session: Symbol() },
                error: message,
              },
        );
      }
    },
    [webId, score, storageKey, navigate, transition],
  );

  const submitTake = useCallback(() => {
    const latest = current.current;
    if (latest?.phase !== "takeCountdown" && latest?.phase !== "takeReview")
      return;
    void upload(latest.draft, midiStringToBlob(latest.draft.take.midiData));
  }, [upload]);

  useEffect(() => {
    if (state.phase !== "takeCountdown") return;
    const timer = setTimeout(
      () => {
        const latest = current.current;
        if (latest?.phase === "takeCountdown" && Date.now() >= latest.deadline)
          submitTake();
      },
      Math.max(0, state.deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state, submitTake]);

  const reviewTake = (confirmingDiscard = false) => {
    const latest = current.current;
    if (latest?.phase !== "takeCountdown" && latest?.phase !== "takeReview")
      return;
    transition({
      phase: "takeReview",
      draft: latest.draft,
      error: latest.phase === "takeReview" ? latest.error : null,
      confirmingDiscard,
    });
  };

  const discardTake = () => {
    const latest = current.current;
    if (latest?.phase !== "takeReview" || !latest.confirmingDiscard) return;
    persist(storageKey, null);
    transition({ phase: "ready" });
  };

  const editMetadata = (change: Partial<Metadata>) => {
    const latest = current.current;
    if (
      latest?.phase !== "takeCountdown" &&
      latest?.phase !== "takeReview" &&
      latest?.phase !== "fileSelect"
    )
      return;
    if (latest.phase === "fileSelect") {
      transition({ ...latest, draft: { ...latest.draft, ...change } });
    } else {
      transition({ ...latest, draft: { ...latest.draft, ...change } });
    }
  };

  const toggleFileUpload = () => {
    const latest = current.current;
    if (latest?.phase === "ready")
      transition({
        phase: "fileSelect",
        draft: { kind: "file", session: Symbol(), ...emptyMetadata },
        error: null,
      });
    else if (latest?.phase === "fileSelect") transition({ phase: "ready" });
  };

  const acceptFile = (session: symbol, file: File) => {
    const latest = current.current;
    if (latest?.phase !== "fileSelect" || latest.draft.session !== session)
      return;
    void upload(latest.draft, file);
  };

  const rejectFile = (session: symbol, error: string) => {
    const latest = current.current;
    if (latest?.phase !== "fileSelect" || latest.draft.session !== session)
      return;
    transition({ ...latest, error });
  };

  return {
    state,
    handleMidiMessage,
    submitTake,
    reviewTake,
    discardTake,
    editMetadata,
    toggleFileUpload,
    acceptFile,
    rejectFile,
  };
}
